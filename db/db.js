"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DBController = void 0;
const sqlite3_1 = require("sqlite3");
// https://www.fooish.com/nodejs/sqlite.html
class DBController {
    static #instance;
    db;
    constructor() {
        this.db = new sqlite3_1.Database('database.db');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            )
        `);
    }
    static get instance() {
        if (!DBController.#instance) {
            DBController.#instance = new DBController();
        }
        return DBController.#instance;
    }

    directSQL(command) {
        this.db.exec(command);
    }

    getItemById(id: string) {
        
    }
}
exports.DBController = DBController;
