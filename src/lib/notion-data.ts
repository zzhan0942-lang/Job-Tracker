import { Client } from "@notionhq/client";

export type NotionProperty = {
  type?: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  rollup?: { type?: string; array?: NotionProperty[] };
  relation?: Array<{ id: string }>;
  select?: { name?: string };
  status?: { name?: string };
  date?: { start?: string | null };
  url?: string | null;
};

export type NotionPage = {
  id: string;
  object: string;
  properties: Record<string, NotionProperty>;
};

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const MAX_RELATED_PROGRESS_RECORDS = 100;

export function applicationsDataSourceId() {
  return process.env.NOTION_APPLICATIONS_DATA_SOURCE_ID;
}

export function progressDataSourceId() {
  return process.env.NOTION_PROGRESS_DATA_SOURCE_ID;
}

export async function getDataSourcePages(dataSourceId: string) {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
    });

    pages.push(...(response.results as unknown as NotionPage[]));
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages.filter((page) => page.object === "page");
}

export async function findPageInDataSource(
  dataSourceId: string,
  pageId: string
) {
  const pages = await getDataSourcePages(dataSourceId);
  return pages.find((page) => page.id === pageId) ?? null;
}

export function relatedApplicationIds(page: NotionPage): string[] {
  return page.properties?.["关联岗位"]?.relation?.map(
    (item) => item.id
  ) ?? [];
}

export async function relatedProgressPages(
  progressDataSource: string,
  applicationId: string
) {
  const pages = await getDataSourcePages(progressDataSource);
  const related = pages.filter((page) =>
    relatedApplicationIds(page).includes(applicationId)
  );

  return related.length <= MAX_RELATED_PROGRESS_RECORDS ? related : null;
}
