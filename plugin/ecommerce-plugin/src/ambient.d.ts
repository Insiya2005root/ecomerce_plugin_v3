declare var require: (id: string) => any;
declare var module: any;
declare var process: any;

declare module 'express' {
  export type Express = any;
  export type Request = any;
  export type Response = any;
}

declare module 'mongoose' {
  const mongoose: any;
  export default mongoose;
  export const Schema: any;
  export const Types: any;
}
