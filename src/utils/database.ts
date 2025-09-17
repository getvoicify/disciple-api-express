import postgres from 'postgres';

export type DbConfig = {
    DB_NAME: string,
    DB_USER: string,
    DB_PASSWORD: string,
    DB_HOST: string,
    DB_PORT: string,
}

export function getRawDb(env: DbConfig) {
    const {
        DB_NAME: database,
        DB_USER: username,
        DB_PASSWORD: password,
        DB_HOST: host,
        DB_PORT: port,
    } = env;
    return postgres({
        database,
        username,
        password,
        host,
        port: port ? parseInt(port, 10) : 5432,
        max: 5,
        fetch_types: false,
        ssl: false,
    });
}

export type RawDb = ReturnType<typeof getRawDb>;