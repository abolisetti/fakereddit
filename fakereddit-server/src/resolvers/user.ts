import { User } from "../entities/User";
import { Arg, Ctx, Field, FieldResolver, Mutation, ObjectType, Query, Resolver, Root } from "type-graphql";
import { MyContext } from "../types";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";
import { getConnection } from "typeorm";
@ObjectType()
class FieldError {
    @Field()
    field: string;
    @Field()
    message: string;
}
@ObjectType()
class UserResponse{
    @Field(() => [FieldError], {nullable: true})
    errors?: FieldError[];

    @Field(() => User, {nullable: true})
    user?: User;
}

@Resolver(User)
export class UserResolver{
    @FieldResolver(() => String)
        email(@Root()user: User, @Ctx() { req }: MyContext){
            // right user, allowed to see own email
            if(req.session.userId === user.id){
                return user.email;
            }
            // not allowed to see anybody elses email
            return "";

    }
    @Mutation(() => UserResponse)
    async changePassword(
        @Arg('token') token: string,
        @Arg('newPassword') newPassword: string,
        @Ctx() {redis, req}: MyContext
    ): Promise<UserResponse> {
        if (newPassword.length <=3){
            return { 
                errors: [
                    {
                        field: "newPassword",
                        message: "Password must be length 4",
                    },
                ],
            };
        }
        const key = FORGET_PASSWORD_PREFIX+token;
        const userId = await redis.get(key);
        if(!userId){
            return { 
                errors: [
                    {
                        field: "token",
                        message: "Token Expired",
                    },
                ],
            };
        }
        const userIdNum = parseInt(userId);
        const user = await User.findOne(userIdNum);

        if(!user){
            return { 
                errors: [
                    {
                        field: "token",
                        message: "User no longer exists",
                    },
                ],
            };
        }
        await User.update(
            {id: userIdNum},
            {
                password: newPassword
            }
        );
        await redis.del(key);
        // log in user after we change the 
        req.session.userId = user.id;
        return {user};

    }
    @Mutation(() => Boolean)
    async forgotPassword(
        @Arg('email') email: string,
        @Ctx() {redis} : MyContext
    ) {
        const user = await User.findOne({where: { email }});
        if(!user){
            return true;
        }
        const token = v4();
        await redis.set(FORGET_PASSWORD_PREFIX + token, user.id, "ex", 1000 * 60 * 60 * 24 * 3);
        await sendEmail(
            email, 
            `<a href="http://localhost:3000/change-password/${token}">reset password</a>`,
            );
        return true;
    }
    @Query(() => User, {nullable:true})
    async me(
        @Ctx() { req, } : MyContext
    ) {
        // not logged in
        if (!req.session.userId){
            return null
        }

        const user = await User.findOne(req.session.userId);
        
        return user;
    }
    @Mutation(() => UserResponse)
    async register(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx() {req }: MyContext
    ): Promise<UserResponse> {
        const errors = validateRegister(options);
        if(errors){
            return {errors};
        }

        const hashedPassword = options.password
        let user;
        // const user = User.create( 
        // { 
        //     username: options.username,
        //     email: options.email,
        //     password: hashedPassword, 
        // });
        try{
            const result = await getConnection()
                .createQueryBuilder()
                .insert()
                .into(User)
                .values({
                    username: options.username,
                    email: options.email,
                    password: hashedPassword,
                })
                .returning("*")
                .execute();
            user = result.raw[0];
        } catch(err){
            console.log("err: ", err);
            if(err.code === "23505" || err.detail.includes("already exists")){
                return {
                    errors: [
                        {
                            field: "username",
                            message: "Username already exists",
                        },
                    ],
                };
            }
            console.log("message: ", err.message);
        }
        req.session.userId = user.id;
        return {user};
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg('usernameOrEmail') usernameOrEmail: string,
        @Arg('password') password: string,
        @Ctx() { req }: MyContext
    ): Promise<UserResponse>{
        const user = await User.findOne(
            usernameOrEmail.includes("@")
                ? {where : {email: usernameOrEmail}}
                : {where : {username: usernameOrEmail}}
        );
        if (!user){
            return {
                errors: [
                    {
                        field: "usernameOrEmail",
                        message: "That username or email doesn't exist",
                    },
                ],
                
            };
        }
        const valid = user.password === password;
        if(!valid){
            return {
                errors: [
                    {
                        field: "password",
                        message: "Incorrect password",
                    },
                ],
                
            };
        }
        req.session.userId = user.id;
        return {user};
    }
    @Mutation(() => Boolean)
    logout(@Ctx() { req, res } : MyContext){
        return new Promise((resolve)=>
            req.session.destroy((err) => {
                res.clearCookie(COOKIE_NAME);
                if (err) {
                    console.log(err);
                    resolve(false);
                    return;
                }
                resolve(true)
            })
        );
    }
    
}
