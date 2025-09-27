import { Database } from "bun:sqlite";

const db = new Database("database.sqlite");

export default db;