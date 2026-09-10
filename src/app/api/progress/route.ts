import {
  badRequestResponse,
  parseProgressDelete,
  parseProgressInput,
  readJson,
} from "@/lib/api-validation";
import { requireApiAuth } from "@/lib/api-auth";
import {
  applicationsDataSourceId,
  findPageInDataSource,
  getDataSourcePages,
  notion,
  type NotionPage,
  type NotionProperty,
  progressDataSourceId,
  relatedApplicationIds,
} from "@/lib/notion-data";

function unavailableResponse() {
  return Response.json(
    { success: false, error: "服务暂不可用" },
    { status: 503 }
  );
}

function notFoundResponse() {
  return Response.json(
    { success: false, error: "记录不存在" },
    { status: 404 }
  );
}

function internalErrorResponse() {
  return Response.json(
    { success: false, error: "操作失败，请稍后重试" },
    { status: 500 }
  );
}

function getText(property: NotionProperty | undefined) {
  if (!property) return "";

  if (property.type === "title") {
    return property.title?.map((item) => item.plain_text ?? "").join("") ?? "";
  }

  if (property.type === "rich_text") {
    return (
      property.rich_text?.map((item) => item.plain_text ?? "").join("") ?? ""
    );
  }

  return "";
}

function getRollupText(property: NotionProperty | undefined) {
  if (!property || property.type !== "rollup") return "";

  const items = property.rollup?.array;
  if (property.rollup?.type !== "array" || !items) return "";

  return items
    .map((item) => getText(item))
    .filter(Boolean)
    .join("、");
}

function getApplicationStatus(event: string, result: string) {
  if (
    event === "淘汰" ||
    event === "主动放弃" ||
    result === "淘汰" ||
    result === "主动放弃" ||
    result === "流程终止"
  ) {
    return "已挂";
  }

  if (event === "收到Offer" || result === "Offer") return "收到offer";
  if (event === "投递") return "已投递";
  if (event === "收到测评") return "测评中";
  if (event === "完成测评") return "已测评";
  if (event === "收到笔试") return "笔试中";
  if (event === "完成笔试") return "已笔试";

  if (
    event.includes("AI面") ||
    event.includes("一面") ||
    event.includes("二面") ||
    event.includes("三面") ||
    event.includes("HR面")
  ) {
    return "面试中";
  }

  return null;
}

async function verifiedRelatedApplication(
  progressPage: NotionPage,
  requestedApplicationId: string | undefined,
  applicationsDataSource: string
) {
  const applicationIds = relatedApplicationIds(progressPage);

  if (applicationIds.length !== 1) return null;

  const applicationId = applicationIds[0];
  if (requestedApplicationId && requestedApplicationId !== applicationId) {
    return null;
  }

  return findPageInDataSource(applicationsDataSource, applicationId);
}

export async function GET(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const dataSourceId = progressDataSourceId();
  if (!dataSourceId) return unavailableResponse();

  try {
    const allPages = await getDataSourcePages(dataSourceId);
    const progress = allPages
      .map((page) => {
        const properties = page.properties;

        return {
          id: page.id,
          applicationIds: relatedApplicationIds(page),
          title: getText(properties["记录标题"]),
          company: getRollupText(properties["公司名称"]),
          role: getRollupText(properties["岗位名称"]),
          base: getRollupText(properties["Base"]),
          event: properties["事件类型"]?.select?.name ?? "",
          stage: properties["阶段"]?.select?.name ?? "",
          result: properties["结果"]?.select?.name ?? "",
          date: properties["事件日期"]?.date?.start ?? null,
          nextDate: properties["下一步日期"]?.date?.start ?? null,
          note: getText(properties["备注"]),
          link: properties["相关链接"]?.url ?? null,
        };
      })
      .filter((item) => item.title || item.company || item.role || item.event)
      .sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });

    return Response.json({ success: true, count: progress.length, progress });
  } catch (error) {
    console.error("Failed to load progress", error);
    return internalErrorResponse();
  }
}

export async function POST(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await readJson(request);
  const input = parseProgressInput(body, false);
  if (!input?.applicationId) return badRequestResponse();

  const applicationsDataSource = applicationsDataSourceId();
  const progressDataSource = progressDataSourceId();
  if (!applicationsDataSource || !progressDataSource) return unavailableResponse();

  try {
    const application = await findPageInDataSource(
      applicationsDataSource,
      input.applicationId
    );
    if (!application) return notFoundResponse();

    const page = await notion.pages.create({
      parent: { data_source_id: progressDataSource },
      properties: {
        记录标题: {
          title: [
            {
              text: {
                content: `${input.company}｜${input.role}｜${input.event}`,
              },
            },
          ],
        },
        关联岗位: { relation: [{ id: application.id }] },
        事件类型: { select: { name: input.event } },
        阶段: { select: { name: input.stage } },
        事件日期: { date: input.date ? { start: input.date } : null },
        结果: { select: { name: input.result } },
        下一步日期: {
          date: input.nextDate ? { start: input.nextDate } : null,
        },
        备注: {
          rich_text: input.note ? [{ text: { content: input.note } }] : [],
        },
        相关链接: { url: input.link },
      },
    });

    const nextApplicationStatus = getApplicationStatus(input.event, input.result);
    if (nextApplicationStatus) {
      await notion.pages.update({
        page_id: application.id,
        properties: { 投递状态: { status: { name: nextApplicationStatus } } },
      });
    }

    return Response.json({ success: true, id: page.id });
  } catch (error) {
    console.error("Failed to create progress", error);
    return internalErrorResponse();
  }
}

export async function PATCH(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await readJson(request);
  const input = parseProgressInput(body, true);
  if (!input?.id) return badRequestResponse();

  const applicationsDataSource = applicationsDataSourceId();
  const progressDataSource = progressDataSourceId();
  if (!applicationsDataSource || !progressDataSource) return unavailableResponse();

  try {
    const progressPage = await findPageInDataSource(progressDataSource, input.id);
    if (!progressPage) return notFoundResponse();

    const application = await verifiedRelatedApplication(
      progressPage,
      input.applicationId,
      applicationsDataSource
    );
    if (!application) return badRequestResponse();

    await notion.pages.update({
      page_id: progressPage.id,
      properties: {
        记录标题: {
          title: [
            {
              text: {
                content: `${input.company}｜${input.role}｜${input.event}`,
              },
            },
          ],
        },
        事件类型: { select: { name: input.event } },
        阶段: { select: { name: input.stage } },
        结果: { select: { name: input.result } },
        事件日期: { date: input.date ? { start: input.date } : null },
        下一步日期: {
          date: input.nextDate ? { start: input.nextDate } : null,
        },
        备注: {
          rich_text: input.note ? [{ text: { content: input.note } }] : [],
        },
        相关链接: { url: input.link },
      },
    });

    if (input.syncStatus) {
      const nextStatus = getApplicationStatus(input.event, input.result);
      if (nextStatus) {
        await notion.pages.update({
          page_id: application.id,
          properties: { 投递状态: { status: { name: nextStatus } } },
        });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to update progress", error);
    return internalErrorResponse();
  }
}

export async function DELETE(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await readJson(request);
  const input = parseProgressDelete(body);
  if (!input) return badRequestResponse();

  const applicationsDataSource = applicationsDataSourceId();
  const progressDataSource = progressDataSourceId();
  if (!applicationsDataSource || !progressDataSource) return unavailableResponse();

  try {
    const progressPage = await findPageInDataSource(progressDataSource, input.id);
    if (!progressPage) return notFoundResponse();

    const application = await verifiedRelatedApplication(
      progressPage,
      input.applicationId,
      applicationsDataSource
    );
    if (!application) return badRequestResponse();

    await notion.pages.update({ page_id: progressPage.id, in_trash: true });

    if (input.syncStatus && input.fallbackStatus) {
      await notion.pages.update({
        page_id: application.id,
        properties: {
          投递状态: { status: { name: input.fallbackStatus } },
        },
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete progress", error);
    return internalErrorResponse();
  }
}
