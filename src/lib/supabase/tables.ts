import type { Database, Json } from "./database.types";

type Tables = Database["public"]["Tables"];

/** A row as the database returns it, an insert, and an update, by table name. */
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];
export type { Json };
