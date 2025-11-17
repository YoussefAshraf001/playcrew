declare module "jsmediatags" {
  export interface Tags {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    genre?: string;
    [key: string]: any;
  }

  export interface TagResult {
    tags: Tags;
  }

  export interface ReaderOptions {
    onSuccess: (tag: TagResult) => void;
    onError: (error: any) => void;
  }

  export function read(file: string, options: ReaderOptions): void;
}
