export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
  items?: JsonSchema;
  enum?: (string | number)[];
}

export interface JsonSchemaProperty extends JsonSchema {
  // Additional properties can be added here if needed
}
