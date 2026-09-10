import {
  badRequestResponse,
  parseApplicationDelete,
  parseApplicationInput,
  readJson,
} from "@/lib/api-validation";
import { requireApiAuth } from "@/lib/api-auth";
import {
  applicationsDataSourceId,
  findPageInDataSource,
  getDataSourcePages,
  notion,
  type NotionProperty,
  progressDataSourceId,
  relatedProgressPages,
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

export async function GET(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const dataSourceId = applicationsDataSourceId();
  if (!dataSourceId) return unavailableResponse();

  try {
    const pages = await getDataSourcePages(dataSourceId);
    const applications = pages
      .map((page) => {
        const properties = page.properties;

        return {
          id: page.id,
          company: getText(properties["公司名称"]),
          role: getText(properties["岗位名称"]),
          title: getText(properties["岗位标识"]),
          status: properties["投递状态"]?.status?.name ?? "",
          base: getText(properties["Base"]),
          date: properties["日期"]?.date?.start ?? null,
        };
      })
      .filter((item) => item.company || item.role || item.title);

    return Response.json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.error("Failed to load applications", error);
    return internalErrorResponse();
  }
}

export async function POST(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await readJson(request);
  const input = parseApplicationInput(body, false);
  if (!input) return badRequestResponse();

  const dataSourceId = applicationsDataSourceId();
  if (!dataSourceId) return unavailableResponse();

  try {
    const page = await notion.pages.create({
      parent: { data_source_id: dataSourceId },
      properties: {
        岗位标识: {
          title: [{ text: { content: `${input.company}｜${input.role}` } }],
        },
        公司名称: {
          rich_text: [{ text: { content: input.company } }],
        },
        岗位名称: {
          rich_text: [{ text: { content: input.role } }],
        },
        Base: {
          rich_text: input.base ? [{ text: { content: input.base } }] : [],
        },
        投递状态: { status: { name: input.status } },
        日期: { date: input.date ? { start: input.date } : null },
        备注: {
          rich_text: input.note ? [{ text: { content: input.note } }] : [],
        },
        官网链接: { url: input.url },
      },
    });

    return Response.json({ success: true, id: page.id });
  } catch (error) {
    console.error("Failed to create application", error);
    return internalErrorResponse();
  }
}

export async function PATCH(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await readJson(request);
  const input = parseApplicationInput(body, true);
  if (!input?.id) return badRequestResponse();

  const dataSourceId = applicationsDataSourceId();
  if (!dataSourceId) return unavailableResponse();

  try {
    const existingPage = await findPageInDataSource(dataSourceId, input.id);
    if (!existingPage) return notFoundResponse();

    await notion.pages.update({
      page_id: existingPage.id,
      properties: {
        岗位标识: {
          title: [{ text: { content: `${input.company}｜${input.role}` } }],
        },
        公司名称: {
          rich_text: [{ text: { content: input.company } }],
        },
        岗位名称: {
          rich_text: [{ text: { content: input.role } }],
        },
        Base: {
          rich_text: input.base ? [{ text: { content: input.base } }] : [],
        },
        投递状态: { status: { name: input.status } },
        日期: { date: input.date ? { start: input.date } : null },
        备注: {
          rich_text: input.note ? [{ text: { content: input.note } }] : [],
        },
        官网链接: { url: input.url },
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to update application", error);
    return internalErrorResponse();
  }
}

export async function DELETE(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;

  const body = await readJson(request);
  const input = parseApplicationDelete(body);
  if (!input) return badRequestResponse();

  const applicationsDataSource = applicationsDataSourceId();
  const progressDataSource = progressDataSourceId();
  if (!applicationsDataSource || !progressDataSource) return unavailableResponse();

  try {
    const application = await findPageInDataSource(
      applicationsDataSource,
      input.id
    );
    if (!application) return notFoundResponse();

    const progressPages = await relatedProgressPages(
      progressDataSource,
      application.id
    );
    if (!progressPages) {
      return Response.json(
        { success: false, error: "关联记录数量超限" },
        { status: 400 }
      );
    }

    for (const progressPage of progressPages) {
      await notion.pages.update({ page_id: progressPage.id, in_trash: true });
    }

    await notion.pages.update({ page_id: application.id, in_trash: true });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete application", error);
    return internalErrorResponse();
  }
}
