import { ApolloServer } from 'apollo-server-express';
import "dotenv-safe/config";
import connectRedis from 'connect-redis';
import cors from 'cors';
// import microConfig from "./mikro-orm.config";
import express from 'express';
import session from 'express-session';
import Redis from 'ioredis';
import path from "path";
import "reflect-metadata";
import { buildSchema } from 'type-graphql';
import { createConnection } from 'typeorm';
// import { MikroORM } from "@mikro-orm/core";
import { COOKIE_NAME, __prod__ } from "./constants";
import { Post } from "./entities/Post";
import { Updoot } from "./entities/Updoot";
import { User } from "./entities/User";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
import { createUpdootLoader } from "./utils/createUpdootLoader";
import { createUserLoader } from "./utils/createUserLoader";
const main = async() =>{
    const conn = await createConnection({
        type: "postgres",
        url: process.env.DATABASE_URL,
        logging: true,
        // synchronize: true,
        migrations: [path.join(__dirname, "./migrations/*")],
        entities: [Post, User, Updoot],
    });
    await conn.runMigrations();
    // await Post.delete({});
    // const orm = await MikroORM.init(microConfig);
    // sendEmail("abolisetti@gmail.com", "hello there");
    // await orm.em.nativeDelete(User, {});
    // await orm.getMigrator().up();
    
    const app = express();
    const RedisStore = connectRedis(session);
    const redis = new Redis(process.env.REDIS_URL);
    app.set("trust proxy", 1);
    app.use(
        cors({
            origin: process.env.CORS_ORIGIN,
            credentials: true,
        })
    )

    app.use(
    session({
        name: COOKIE_NAME,
        store: new RedisStore({ 
            client: redis,
            disableTouch: true,
          }),
          cookie:{
              maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
              httpOnly: true,
              sameSite: 'lax', // csrf
              secure: __prod__, // cookie will only work in https
              domain: __prod__ ? '.fakestreddit.com' : undefined,
          },
        saveUninitialized: false,
        secret: process.env.SESSION_SECRET,
        resave: false,
    })
    )
    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver, PostResolver, UserResolver],
            validate: false,
        }),
        context: ( {req, res} ): MyContext => ({ 
            req, 
            res, 
            redis, 
            userLoader: createUserLoader(),
            updootLoader: createUpdootLoader(), 
        }),
    });

    apolloServer.applyMiddleware({ 
        app, 
        cors: false });
    app.listen(parseInt(process.env.PORT), () => {
        console.log('server started on localhost:4000')
    })
    // const post = orm.em.create(Post, {title: 'my first post'});
    // await orm.em.persistAndFlush(post);
    // const posts = await orm.em.find(Post, {});
    // console.log(posts);

};
main().catch((err) => {
    console.error(err)
});
