export type Category = "Stack" | "Cloud" | "Type";
export type Status = "Draft" | "Published" | "Archived";
export interface Tag {
  id: string;
  name: string;
  key: string;
  category: Category;
  count: number;
}
export interface Media {
  id: string;
  kind: "Image" | "Video";
  url: string;
  caption: string;
  originalName: string;
  size: number;
  sortOrder: number;
  isCover: boolean;
}
export interface Project {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  demoUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  embedDemo: boolean;
  featured: boolean;
  sortOrder: number;
  status: Status;
  version: number;
  updatedAt: string;
  tags: Tag[];
  media: Media[];
}
export interface ProjectInput {
  title: string;
  slug: string;
  summary: string;
  description: string;
  demoUrl: string;
  githubUrl: string;
  websiteUrl: string;
  embedDemo: boolean;
  featured: boolean;
  sortOrder: number;
  status: Status;
  version: number;
  stacks: string[];
  clouds: string[];
  types: string[];
}
export interface Page {
  items: Project[];
  total: number;
  page: number;
  pageSize: number;
}
