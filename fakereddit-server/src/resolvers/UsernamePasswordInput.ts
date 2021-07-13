import { Field, InputType } from "type-graphql";

// import { EntityManager } from '@mikro-orm/postgresql';
@InputType()
export class UsernamePasswordInput {
    @Field()
    email: string;
    @Field()
    username: string;
    @Field()
    password: string;
}
