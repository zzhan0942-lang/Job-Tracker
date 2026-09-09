import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

function getText(property: any) {
  if (!property) return "";

  if (property.type === "title") {
    return (
      property.title
        ?.map((item: any) => item.plain_text)
        .join("") ?? ""
    );
  }

  if (property.type === "rich_text") {
    return (
      property.rich_text
        ?.map((item: any) => item.plain_text)
        .join("") ?? ""
    );
  }

  return "";
}

function getRollupText(property: any) {
  if (!property || property.type !== "rollup") return "";

  const rollup = property.rollup;

  if (rollup?.type === "array") {
    return rollup.array
      .map((item: any) => {
        if (item.type === "title") {
          return (
            item.title
              ?.map((text: any) => text.plain_text)
              .join("") ?? ""
          );
        }

        if (item.type === "rich_text") {
          return (
            item.rich_text
              ?.map((text: any) => text.plain_text)
              .join("") ?? ""
          );
        }

        return "";
      })
      .filter(Boolean)
      .join("、");
  }

  return "";
}
function getApplicationStatus(
  event: string,
  result: string
) {
  // 终止类结果优先
  if (
    event === "淘汰" ||
    event === "主动放弃" ||
    result === "淘汰" ||
    result === "主动放弃" ||
    result === "流程终止"
  ) {
    return "已挂";
  }

  if (
    event === "收到Offer" ||
    result === "Offer"
  ) {
    return "收到offer";
  }

  if (event === "投递") {
    return "已投递";
  }

  if (event === "收到测评") {
    return "测评中";
  }

  if (event === "完成测评") {
    return "已测评";
  }

  if (event === "收到笔试") {
    return "笔试中";
  }

  if (event === "完成笔试") {
    return "已笔试";
  }

  if (
    event.includes("AI面") ||
    event.includes("一面") ||
    event.includes("二面") ||
    event.includes("三面") ||
    event.includes("HR面")
  ) {
    return "面试中";
  }

  // 流程暂停、其他等事件不强行修改当前状态
  return null;
}

export async function GET() {
  try {
    const dataSourceId =
      process.env.NOTION_PROGRESS_DATA_SOURCE_ID;

    if (!dataSourceId) {
      return Response.json(
        {
          success: false,
          error: "缺少 NOTION_PROGRESS_DATA_SOURCE_ID",
        },
        { status: 500 }
      );
    }

    let allPages: any[] = [];
    let cursor: string | undefined = undefined;

    do {
      const response = await notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
        start_cursor: cursor,
      });

      allPages = [...allPages, ...response.results];

      cursor = response.has_more
        ? response.next_cursor ?? undefined
        : undefined;
    } while (cursor);

    const progress = allPages
      .filter((page: any) => page.object === "page")
      .map((page: any) => {
        const properties = page.properties;

        return {
          id: page.id,
          
          applicationIds:
  properties["关联岗位"]?.relation?.map(
    (item: any) => item.id
  ) ?? [],

          title: getText(properties["记录标题"]),

          company: getRollupText(
            properties["公司名称"]
          ),

          role: getRollupText(
            properties["岗位名称"]
          ),

          base: getRollupText(properties["Base"]),

          event:
            properties["事件类型"]?.select?.name ?? "",

          stage:
            properties["阶段"]?.select?.name ?? "",

          result:
            properties["结果"]?.select?.name ?? "",

          date:
            properties["事件日期"]?.date?.start ?? null,

          nextDate:
            properties["下一步日期"]?.date?.start ?? null,

          note: getText(properties["备注"]),

          link:
            properties["相关链接"]?.url ?? null,
        };
      })
      .filter(
        (item: any) =>
          item.title ||
          item.company ||
          item.role ||
          item.event
      );

    progress.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;

      return b.date.localeCompare(a.date);
    });

    return Response.json({
      success: true,
      count: progress.length,
      progress,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      applicationId,
      company,
      role,
      event,
      stage,
      result,
      date,
      nextDate,
      note,
      link,
    } = body;

    if (!applicationId || !event) {
      return Response.json(
        {
          success: false,
          error: "缺少岗位或事件类型",
        },
        { status: 400 }
      );
    }

    const dataSourceId =
      process.env.NOTION_PROGRESS_DATA_SOURCE_ID;

    if (!dataSourceId) {
      return Response.json(
        {
          success: false,
          error: "缺少进度数据库 ID",
        },
        { status: 500 }
      );
    }

    const recordTitle =
      `${company || ""}｜${role || ""}｜${event}`;

    const page = await notion.pages.create({
      parent: {
        data_source_id: dataSourceId,
      },

      properties: {
        记录标题: {
          title: [
            {
              text: {
                content: recordTitle,
              },
            },
          ],
        },

        关联岗位: {
          relation: [
            {
              id: applicationId,
            },
          ],
        },

        事件类型: {
          select: {
            name: event,
          },
        },

        阶段: {
          select: {
            name: stage,
          },
        },

        事件日期: {
          date: date
            ? {
                start: date,
              }
            : null,
        },

        结果: {
          select: {
            name: result,
          },
        },

        下一步日期: {
          date: nextDate
            ? {
                start: nextDate,
              }
            : null,
        },

        备注: {
          rich_text: note
            ? [
                {
                  text: {
                    content: note,
                  },
                },
              ]
            : [],
        },

        相关链接: {
          url: link || null,
        },
      },
    });
    
    const nextApplicationStatus =
  getApplicationStatus(event, result);

if (nextApplicationStatus) {
  await notion.pages.update({
    page_id: applicationId,

    properties: {
      投递状态: {
        status: {
          name: nextApplicationStatus,
        },
      },
    },
  });
}

    return Response.json({
      success: true,
      id: page.id,
    });
  } catch (error) {
    console.error("新增进展失败：", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const {
      id,
      applicationId,
      company,
      role,
      event,
      stage,
      result,
      date,
      nextDate,
      note,
      link,
      syncStatus,
    } = body;

    if (!id) {
      return Response.json(
        { success: false, error: "缺少进展 ID" },
        { status: 400 }
      );
    }

    await notion.pages.update({
      page_id: id,

      properties: {
        记录标题: {
          title: [
            {
              text: {
                content: `${company}｜${role}｜${event}`,
              },
            },
          ],
        },

        事件类型: {
          select: {
            name: event,
          },
        },

        阶段: {
          select: {
            name: stage,
          },
        },

        结果: {
          select: {
            name: result,
          },
        },

        事件日期: {
          date: date
            ? {
                start: date,
              }
            : null,
        },

        下一步日期: {
          date: nextDate
            ? {
                start: nextDate,
              }
            : null,
        },

        备注: {
          rich_text: note
            ? [
                {
                  text: {
                    content: note,
                  },
                },
              ]
            : [],
        },

        相关链接: {
          url: link || null,
        },
      },
    });

    // 如果编辑的是最新进展，同步第一张表
    if (syncStatus && applicationId) {
      const nextStatus =
        getApplicationStatus(event, result);

      if (nextStatus) {
        await notion.pages.update({
          page_id: applicationId,

          properties: {
            投递状态: {
              status: {
                name: nextStatus,
              },
            },
          },
        });
      }
    }

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("编辑进展失败：", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "编辑进展失败",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    const {
      id,
      applicationId,
      syncStatus,
      fallbackStatus,
    } = body;

    if (!id) {
      return Response.json(
        { success: false, error: "缺少进展 ID" },
        { status: 400 }
      );
    }

    await notion.pages.update({
      page_id: id,
      in_trash: true,
    });

    // 如果删除的是最新进展，让第一张表退回上一阶段
    if (
      syncStatus &&
      applicationId &&
      fallbackStatus
    ) {
      await notion.pages.update({
        page_id: applicationId,

        properties: {
          投递状态: {
            status: {
              name: fallbackStatus,
            },
          },
        },
      });
    }

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("删除进展失败：", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "删除进展失败",
      },
      { status: 500 }
    );
  }
}