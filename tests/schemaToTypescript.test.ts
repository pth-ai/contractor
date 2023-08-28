import {JSONSchemaType} from "ajv";
import {expect} from "chai";
import {SchemaToTypescript} from "../lib/SchemaToTypescript";
import {reduceAndTrim} from "./testHelpers";

describe('SchemaToTypescript', () => {

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
        const converter = new SchemaToTypescript(schema as JSONSchemaType<any>, "SimpleObject");
        const typeStore = converter.getTypeStore();

        expect(typeStore).to.have.property("SimpleObject");
        expect(typeStore.SimpleObject).to.equal(schema);
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
        const converter = new SchemaToTypescript(schema as JSONSchemaType<any>, "User");
        const result = converter.generateTypescript();

        const expectedTS = `
interface User {
    name: string;  // Name of the user
    age?: number;
}
`;

        expect(reduceAndTrim(result)).to.equal(reduceAndTrim(expectedTS));
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
        const converter = new SchemaToTypescript(schema as JSONSchemaType<any>, "NestedObject");
        const typeStore = converter.getTypeStore();
        expect(typeStore).to.have.property("NestedObject");
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

        const converter = new SchemaToTypescript(userSchema as JSONSchemaType<any>, "UserWithContactDetails");
        const typeStore = converter.getTypeStore();

        expect(typeStore).to.have.property("UserWithContactDetails");
        expect(typeStore).to.have.property("ContactDetails");

    });


});
