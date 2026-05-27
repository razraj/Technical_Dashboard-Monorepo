export interface User {
    id: string;
    email?: string;
    username?: string;
    firstName?: string | null;
    lastName?: string | null;
    profilePic?: string | null;
    refreshToken?: string | null;
}

export const UserResponseDefault = {
    users: [] as User[],
    total: 0,
    message: ""
};
export type UserResponse = typeof UserResponseDefault;
