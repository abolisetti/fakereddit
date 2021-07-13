import { UsernamePasswordInput } from "../resolvers/UsernamePasswordInput";

export const validateRegister = (options: UsernamePasswordInput) => {
    if (options.username.length <=2){
        return [
            {
                field: "username",
                message: "Username must be length 3",
            },
        ];
    }
    if (options.username.includes("@")){
        return [
            {
                field: "username",
                message: "Username cannot have @ symbol",
            },
        ];
    }
    if (!options.email.includes("@")){
        return [
            {
                field: "email",
                message: "Invalid email address",
            },
        ];
    }
    if (options.password.length <=3){
        return [
            {
                field: "password",
                message: "Password must be length 4",
            },
        ];
    }
    return null;
}
