import Ajv, {JSONSchemaType, ValidateFunction} from "ajv";
import {stringToHashKey} from "./utils";

export class SchemaValidationCache {
    private ajv: Ajv;
    private readonly cache: Record<string, ValidateFunction>;

    constructor() {
        this.ajv = new Ajv();
        this.cache = {};
    }

    getValidator<T>(schema: JSONSchemaType<T>): ValidateFunction<T> {
        const schemaKey = stringToHashKey(JSON.stringify(schema));

        if (!this.cache[schemaKey]) {
            this.cache[schemaKey] = this.ajv.compile(schema);
        }

        return this.cache[schemaKey] as ValidateFunction<T>;
    }
}