import { Database } from 'sqlite3'

// https://www.fooish.com/nodejs/sqlite.html

export class DBController {
    static #instance: DBController
    protected db: Database
    private constructor () {
        this.db = new Database('database.db');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT NOT NULL,
                name TEXT NOT NULL,
                brand TEXT NOT NULL,
                category TEXT NOT NULL,
                tone TEXT NOT NULL,
                zone TEXT NOT NULL,
                expiry TEXT NOT NULL,
                photo TEXT NOT NULL
            )
        `)
    }

    public static get instance(): DBController {
        if (!DBController.#instance) {
            DBController.#instance = new DBController()
        }

        return DBController.#instance
    }

    public directSQL (command: string) {
        const result = this.db.all<Object>(command, (err, rows) => {
            if (!err) {
                return err
            }
            return rows
        })
    }
    

    public getItemById(id: string) {
        const findItem = this.db.prepare('SELECT * FROM products WHERE id = ?');
    }
}