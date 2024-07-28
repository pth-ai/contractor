import {JSONSchemaType} from "ajv";
import {JSONSchemaToTypescriptConverter} from "../lib/JSONSchemaToTypescriptConverter";
import {reduceAndTrim} from "./testHelpers";

describe('JSONSchemaToTypescriptConverter', () => {

    it('should process simple object schema', async () => {
        const schema: JSONSchemaType<{
            name: string,
            age?: number
        }> = {
            type: "object",
            required: ["name"],
            $id: "simpleObject",
            properties: {
                name: {type: "string", nullable: false, description: "Name of the user"},
                age: {type: "number", nullable: true,}
            },
        };
        const converter = new JSONSchemaToTypescriptConverter(schema as JSONSchemaType<any>, "SimpleObject");
        const typeStore = converter.getTypeStore();

        expect(typeStore).toHaveProperty("SimpleObject");
        expect(typeStore.SimpleObject).toEqual(schema);
    });

    it('should generate correct Typescript for simple object', async () => {
        const schema: JSONSchemaType<{
            name: string,
            age?: number
        }> = {
            type: "object",
            required: ['name'],
            $id: "simpleObject",
            properties: {
                name: {type: "string", description: "Name of the user", nullable: false},
                age: {type: "number", nullable: true}
            },
        };
        const converter = new JSONSchemaToTypescriptConverter(schema as JSONSchemaType<any>, "User");
        const result = converter.generateTypescript();

        const expectedTS = `
interface User {
    name: string // Name of the user
    age?: number
}
`;

        expect(reduceAndTrim(result)).toEqual(reduceAndTrim(expectedTS));
    });

    it('should process nested object schema', async () => {
        const schema: JSONSchemaType<{
            user: {
                name: string,
                age?: number
            }
        }> = {
            type: "object",
            $id: "nestedObject",
            required: ['user'],
            properties: {
                user: {
                    type: "object",
                    nullable: false,
                    required: ['name'],
                    properties: {
                        name: {type: "string", nullable: false},
                        age: {type: "number", nullable: true}
                    }
                },
            },
        };
        const converter = new JSONSchemaToTypescriptConverter(schema as JSONSchemaType<any>, "NestedObject");
        const typeStore = converter.getTypeStore();
        expect(typeStore).toHaveProperty("NestedObject");
    });

    it('should process array of items holding another schema object', async () => {
        const contactDetailsSchema: JSONSchemaType<{
            phoneNumber: string;
            email: string;
        }> = {
            $id: 'ContactDetails',
            type: "object",
            required: ['phoneNumber', 'email'],
            title: 'ContactDetails',
            properties: {
                phoneNumber: {type: "string", nullable: false},
                email: {type: "string", format: "email", nullable: false}
            },
        };

        const userSchema: JSONSchemaType<{
            name: string,
            age?: number,
            contactDetails: {
                phoneNumber: string;
                email: string;
            }[]
        }> = {
            type: "object",
            required: ['name', 'contactDetails'],
            properties: {
                name: {type: "string", nullable: false},
                age: {type: "number", nullable: true},
                contactDetails: {
                    type: "array",
                    nullable: false,
                    items: contactDetailsSchema
                }
            },
        };

        const converter = new JSONSchemaToTypescriptConverter(userSchema as JSONSchemaType<any>, "UserWithContactDetails");
        const typeStore = converter.getTypeStore();

        expect(typeStore).toHaveProperty("UserWithContactDetails");
        expect(typeStore).toHaveProperty("ContactDetails");

    });

    it('should process array of items that are union type', async () => {
        const scheduleSchema: JSONSchemaType<{
            daysOfWeek: ('Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday')[];
        }> = {
            $id: 'Schedule',
            type: "object",
            title: 'Schedule',
            properties: {
                daysOfWeek: {
                    type: "array",
                    items: {
                        type: "string",
                        enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                    },
                    nullable: false,
                },
            },
            required: ['daysOfWeek'],
        };


        const converter = new JSONSchemaToTypescriptConverter(scheduleSchema as JSONSchemaType<any>, "Schedule");
        const typeStore = converter.getTypeStore();

        expect(typeStore).toHaveProperty("Schedule");

    });

    it('should extend schema with additional properties', async () => {
        const baseSchema: JSONSchemaType<{
            name: string,
        }> = {
            type: "object",
            required: ["name"],
            properties: {
                name: {type: "string", nullable: false}
            },
        };

        const extensionSchema: JSONSchemaType<{ age?: number, email: string }> = {
            type: "object",
            properties: {
                age: {type: "number", description: "Age of the person", nullable: true},
                email: {type: "string", format: "email", description: "Email address of the person", nullable: false}
            },
            required: ['email'],
        };

        const converter = new JSONSchemaToTypescriptConverter(baseSchema as JSONSchemaType<any>, "Person");
        converter.extendFromSchema(extensionSchema as JSONSchemaType<any>);
        const typeStore = converter.getTypeStore();

        // Check if the base type has been extended
        expect(typeStore).toHaveProperty("Person");
        const personSchema = typeStore.Person as any;
        expect(personSchema.properties).toHaveProperty("age");
        expect(personSchema.properties).toHaveProperty("email");
        expect(personSchema.properties.age.type).toEqual("number");
        expect(personSchema.properties.email.type).toEqual("string");

        // Optionally, generate TypeScript and check if the output includes the extended properties
        const tsResult = converter.generateTypescript();
        expect(tsResult).toContain("age?: number"); // Check for extended properties
        expect(tsResult).toContain("email: string");
    });


});
