import {JSONSchemaType} from "ajv";
import {truthy} from "./utils";

export class SchemaToTypescript {
    private schemaRefStore: Record<string, JSONSchemaType<any>> = {};
    private typeStore: Record<string, JSONSchemaType<any>> = {};

    constructor(rootSchema: JSONSchemaType<any>, private rootName: string) {
        this.processSchema(rootSchema, rootName);
    }

    private processSchema(schema: JSONSchemaType<any>, name: string, isInlined: boolean = false) {
        if (!isInlined && (schema.$id || (schema.type === "object" && schema.properties))) {
            this.registerSchema(schema, name);
        }

        if (schema.type === "object" && schema.properties) {
            for (const propName in schema.properties) {
                const propSchema = schema.properties[propName];
                if (propSchema) {
                    if (propSchema.type === "object") {
                        const nestedTypeName = this.getNestedTypeName(propSchema, propName);
                        this.processSchema(propSchema, nestedTypeName, !propSchema.$id);
                    } else if (propSchema.type === "array" && propSchema.items) {
                        const nestedSchema = propSchema.items;
                        const nestedTypeName = this.getNestedTypeName(nestedSchema, propName);
                        this.processSchema(nestedSchema, nestedTypeName, !nestedSchema.$id);
                    } else {
                        // console.debug('did not process in schema', propSchema);
                    }
                } else {
                    console.debug(`skipping empty property [${propName}] [${JSON.stringify(schema.properties)}]`)
                }

            }
        } else if (schema.oneOf) {
            schema.oneOf.forEach((oo: any, idx: number) => {
                this.processSchema(oo, this.getNestedTypeName(oo, 'oneOf' + idx), true);
            })
        } else if (schema.anyOf) {
            schema.anyOf.forEach((ao: any, idx: number) => {
                this.processSchema(ao, this.getNestedTypeName(ao, 'anyOf' + idx), true);
            })
        }

    }


    public getTypeStore(): Record<string, JSONSchemaType<any>> {
        return this.typeStore;
    }

    public extendFromSchema(sourceSchema: JSONSchemaType<any>): void {
        if (sourceSchema.properties) {
            const rootSchema = this.schemaRefStore[this.rootName];
            rootSchema.properties = {...sourceSchema.properties, ...rootSchema.properties}
            this.processSchema(rootSchema, this.rootName, true);
        }
    }

    private registerSchema(schema: JSONSchemaType<any>, id: string) {
        if (!this.schemaRefStore[id]) {
            this.schemaRefStore[id] = schema;
        }
        if (!this.typeStore[id]) {
            this.typeStore[id] = schema;
        }

    }

    private capitalizeFirstLetter(string: string): string {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    private resolveRef(ref: string): JSONSchemaType<any> | undefined {
        return this.schemaRefStore[ref.replace('#', '')];
    }

    private getNestedTypeName(schema: JSONSchemaType<any>, propName: string) {
        return schema.title ?? this.capitalizeFirstLetter(propName);
    }

    // to typescript string stuff
    private getTypeString(schema: JSONSchemaType<any>, propName: string, schemaTrail: JSONSchemaType<any>[] = [], indent: string = ''): string {
        if (schema.anyOf) {
            return schema.anyOf.map((schema: JSONSchemaType<any>) => {
                let out = "";
                if (schema.description && typeof schema.description === 'string') {
                    out = this.genMultiLinecomment(schema.description, out, indent);
                }
                for (const prop in schema.properties) {
                    out += this.stringifyProperties(schema, prop, schemaTrail, indent + '    ');
                }
                return `{\n${out}${indent}}`;
            }).join(' | ');
        } else if (schema.oneOf) {
            return schema.oneOf.map((schema: JSONSchemaType<any>) => {
                let out = "";
                if (schema.description && typeof schema.description === 'string') {
                    out = this.genMultiLinecomment(schema.description, out, indent);
                }
                for (const prop in schema.properties) {
                    out += this.stringifyProperties(schema, prop, schemaTrail, indent + '    ');
                }
                return `{\n${out}${indent}}`;
            }).join(' | ');
        } else if (schema.$id) {
            //return this.capitalizeFirstLetter(propName);
            return (schema.title ?? this.capitalizeFirstLetter(schema.$id));
        } else if (schema.$ref) {
            const refSchema = this.resolveRef(schema.$ref);
            if (refSchema) {
                return this.capitalizeFirstLetter(propName);
            }
            return 'any';
        } else {
            switch (schema.type) {
                case "array":
                    if (schema.items) {
                        if (Array.isArray(schema.items.type)) {
                            const unionTypes = schema.items.type.map((type: any) => type).join(' | ');
                            return `(${unionTypes})[];`;
                        } else if (schema.items.$ref) {
                            if (schema.items.$ref === '#') {
                                return this.getNestedTypeName([schema, ...schemaTrail].slice(-1)[0]!, propName) + '[]';
                            } else {
                                return truthy(this.resolveRef(schema.items.$ref as string), s => this.getNestedTypeName(s, propName)) ?? 'any[]';
                            }
                        }
                        if (schema.items.$id) {
                            return this.getNestedTypeName(schema.items, propName) + '[]';
                        } else {
                            const items = Array.isArray(schema.items) ? schema.items : [schema.items];
                            const types = items.map(item => this.getTypeString(item, propName, [...schemaTrail, schema], indent + '    ')).join(', ');
                            return `${types}[];`;
                        }
                    }
                    return 'any[]';
                case "object":
                    if (schema.properties) {
                        let out = "";
                        for (const prop in schema.properties) {
                            out += this.stringifyProperties(schema, prop, schemaTrail, indent + '    ');
                        }
                        return `{\n${out}${indent}}`;
                    } else {
                        return `${this.capitalizeFirstLetter(propName)};`;
                    }

                default:
                    // primitives..
                    return (truthy(schema.const, _ => JSON.stringify(_)) ??
                        truthy(schema.enum, (en: string[]) => `( ${en.map(_ => `'${_}'`).join(' | ')} )`) ??
                        schema.type ??
                        'any');
            }
        }
    }

    private genMultiLinecomment(description: string, out: string, indent: string) {
        out += `${indent}/**\n`
        description.split('\n')
            .forEach((l: string) => out += `${indent} * ${l}\n`);
        out += `${indent} */\n`
        return out;
    }

    private schemaToString(name: string, indent: string = ''): string {
        const schema = this.typeStore[name];
        let ts = "";

        if (schema.anyOf) {
            ts += `${indent}type ${this.getNestedTypeName(schema, name)} =\n`
            ts += this.getTypeString(schema, name, [schema], indent + '    ');
            ts += ';\n';
        } else if (schema.oneOf) {
            ts += `${indent}type ${this.getNestedTypeName(schema, name)} =\n`
            ts += this.getTypeString(schema, name, [schema], indent + '    ');
            ts += ';\n';
        } else {
            ts += `${indent}interface ${this.getNestedTypeName(schema, name)} {\n`
            for (const prop in schema.properties) {
                ts += this.stringifyProperties(schema, prop, [schema], indent + '    ');
            }
            ts += `${indent}}\n`;
        }

        // console.debug(`converting [${name}] schema [${JSON.stringify(schema)}] result=[${ts}]}`);
        return ts;
    }

    private stringifyProperties(schema: JSONSchemaType<any>, prop: string, schemaTrail: JSONSchemaType<any>[], indent: string) {
        const propSchema = schema.properties[prop];
        if (typeof propSchema === "boolean") return;
        const type = this.getTypeString(propSchema, prop, schemaTrail, indent);
        const description = propSchema.description ? ` // ${propSchema.description}` : '';
        return `${indent}${prop}${propSchema.nullable ? '?' : ''}: ${type} ${description}\n`;
    }

    public generateTypescript(): string {
        let output = "";
        for (const typeName of Object.keys(this.typeStore).reverse()) {
            output += this.schemaToString(typeName);
            output += '\n';
        }
        return output;
    }
}
