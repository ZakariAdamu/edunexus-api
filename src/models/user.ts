import type { Document} from "mongoose";
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";


export enum UserRole {
	ADMIN = "admin",
	TEACHER = "teacher",
	STUDENT = "student",
	PARENT = "parent",
}

// export type userRoles = "admin" | "teacher" | "student" | "parent";

export interface IUser extends Document {
	name: string;
	email: string;
	password: string;
	role: UserRole;
	isActive?: boolean;
	studentClass?: string;
	teacherSubjects?: string[] | null;
	isVerified?: boolean;
	matchPassword: (enteredPassword: string) => Promise<boolean>;
	verificationCode: string | null;
	passwordResetToken?: string;
	passwordResetExpires?: Date;
	verificationCodeExpires?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
	{
		name: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		password: { type: String, required: true, select: false },
		role: {
			type: String,
			enum: Object.values(UserRole),
			default: UserRole.STUDENT,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		studentClass: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Class",
			default: null,
		},
		teacherSubjects: {
			type: [mongoose.Schema.Types.ObjectId],
			default: [],
		},
		isVerified: {
			type: Boolean,
			default: false,
		},
		verificationCode: {
			type: String,
			select: false,
		},
		verificationCodeExpires: {
			type: Date,
			select: false,
		},
		passwordResetToken: {
			type: String,
			select: false,
		},
		passwordResetExpires: {
			type: Date,
			select: false,
		},
	},
	{
		timestamps: true,
	},
);

// Pre-save hook to hash password if modified
UserSchema.pre<IUser>("save", async function () {
	if (!this.isModified("password")) {
		return;
	}

	const salt = await bcrypt.genSalt(10);
	this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.matchPassword = async function (
	enteredPassword: string,
): Promise<boolean> {
	return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model<IUser>("User", UserSchema);
export default User;
