import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      company,
      role,
      base,
      status,
      date,
      note,
      url,
    } = body;

    if (!company || !role) {
      return Response.json(
        {
          success: false,
          error: "公司名称和岗位名称不能为空",
        },
        { status: 400 }
      );
    }

    const dataSourceId =
      process.env.NOTION_APPLICATIONS_DATA_SOURCE_ID;

    if (!dataSourceId) {
      return Response.json(
        {
          success: false,
          error:
            "缺少 NOTION_APPLICATIONS_DATA_SOURCE_ID",
        },
        { status: 500 }
      );
    }

    const title = `${company}｜${role}`;

    const page = await notion.pages.create({
      parent: {
        data_source_id: dataSourceId,
      },

      properties: {
        岗位标识: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },

        公司名称: {
          rich_text: [
            {
              text: {
                content: company,
              },
            },
          ],
        },

        岗位名称: {
          rich_text: [
            {
              text: {
                content: role,
              },
            },
          ],
        },

        Base: {
          rich_text: base
            ? [
                {
                  text: {
                    content: base,
                  },
                },
              ]
            : [],
        },

        投递状态: {
          status: {
            name: status || "已投递",
          },
        },

        日期: {
          date: date
            ? {
                start: date,
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

        官网链接: {
          url: url || null,
        },
      },
    });

    return Response.json({
      success: true,
      id: page.id,
    });
  } catch (error) {
    console.error("新增岗位失败：", error);

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
      company,
      role,
      base,
      status,
      date,
      note,
      url,
    } = body;

    if (!id) {
      return Response.json(
        {
          success: false,
          error: "缺少岗位 ID",
        },
        { status: 400 }
      );
    }

    if (!company || !role) {
      return Response.json(
        {
          success: false,
          error: "公司名称和岗位名称不能为空",
        },
        { status: 400 }
      );
    }

    const title = `${company}｜${role}`;

    await notion.pages.update({
      page_id: id,

      properties: {
        岗位标识: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },

        公司名称: {
          rich_text: [
            {
              text: {
                content: company,
              },
            },
          ],
        },

        岗位名称: {
          rich_text: [
            {
              text: {
                content: role,
              },
            },
          ],
        },

        Base: {
          rich_text: base
            ? [
                {
                  text: {
                    content: base,
                  },
                },
              ]
            : [],
        },

        投递状态: {
          status: {
            name: status,
          },
        },

        日期: {
          date: date
            ? {
                start: date,
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

        官网链接: {
          url: url || null,
        },
      },
    });

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("修改岗位失败：", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "修改岗位失败",
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
      progressIds = [],
    } = body;

    if (!id) {
      return Response.json(
        {
          success: false,
          error: "缺少岗位 ID",
        },
        { status: 400 }
      );
    }

    // 先删除这个岗位对应的历史进展
    for (const progressId of progressIds) {
      await notion.pages.update({
        page_id: progressId,
        in_trash: true,
      });
    }

    // 再删除岗位本身
    await notion.pages.update({
      page_id: id,
      in_trash: true,
    });

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("删除岗位失败：", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "删除岗位失败",
      },
      { status: 500 }
    );
  }
}