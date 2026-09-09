import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

function getText(property: any) {
  if (!property) return "";

  if (property.type === "title") {
    return property.title
      ?.map((item: any) => item.plain_text)
      .join("") ?? "";
  }

  if (property.type === "rich_text") {
    return property.rich_text
      ?.map((item: any) => item.plain_text)
      .join("") ?? "";
  }

  return "";
}

export async function GET() {
  try {
    const dataSourceId =
      process.env.NOTION_APPLICATIONS_DATA_SOURCE_ID;

    if (!dataSourceId) {
      return Response.json(
        { error: "缺少数据库 ID" },
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

    const applications = allPages
      .filter((page: any) => page.object === "page")
      .map((page: any) => {
        const properties = page.properties;

        return {
          id: page.id,

          company: getText(properties["公司名称"]),

          role: getText(properties["岗位名称"]),

          title: getText(properties["岗位标识"]),

          status:
            properties["投递状态"]?.status?.name ?? "",

          base: getText(properties["Base"]),

          date:
            properties["日期"]?.date?.start ?? null,
        };
        })
  .filter(
    (item: any) =>
      item.company || item.role || item.title
  );

    return Response.json({
      success: true,
      count: applications.length,
      applications,
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