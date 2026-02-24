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
        max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        fetch_types: false,
        ssl: process.env.DB_SSL !== 'false',
        connect_timeout: 5,
        idle_timeout: 30,
    });
}

export type RawDb = ReturnType<typeof getRawDb>;
