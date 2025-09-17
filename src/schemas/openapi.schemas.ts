/**
 * OpenAPI schema definitions for the Disciple API
 * These schemas are used in the Swagger documentation
 */

export const scriptureReferenceSchema = {
    type: 'object',
    required: ['book', 'chapter', 'verse'],
    properties: {
        book: {
            type: 'string',
            description: 'Name of the biblical book',
            example: 'John'
        },
        chapter: {
            type: 'integer',
            minimum: 1,
            description: 'Chapter number',
            example: 3
        },
        verse: {
            type: 'integer',
            minimum: 1,
            description: 'Starting verse number',
            example: 16
        },
        endVerse: {
            type: 'integer',
            minimum: 1,
            description: 'Ending verse number (for verse ranges)',
            example: 17
        }
    }
};

export const noteSchema = {
    type: 'object',
    required: ['id', 'title', 'content', 'date', 'scriptureReferences', 'createdAt', 'updatedAt'],
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the note'
        },
        title: {
            type: 'string',
            minLength: 1,
            description: 'Title of the note',
            example: 'Sunday Sermon Notes'
        },
        content: {
            type: 'string',
            description: 'Main content of the note',
            example: 'God so loved the world...'
        },
        date: {
            type: 'string',
            format: 'date-time',
            description: 'Date the note was taken'
        },
        scriptureReferences: {
            type: 'array',
            items: {
                $ref: '#/components/schemas/ScriptureReference'
            },
            description: 'Array of scripture references'
        },
        images: {
            type: 'array',
            items: {
                type: 'string',
                format: 'uri'
            },
            description: 'Array of image URLs'
        },
        createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the note was created'
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the note was last updated'
        }
    }
};

export const createNoteInputSchema = {
    type: 'object',
    required: ['title', 'content'],
    properties: {
        title: {
            type: 'string',
            minLength: 1,
            description: 'Title of the note',
            example: 'Sunday Sermon Notes'
        },
        content: {
            type: 'string',
            description: 'Main content of the note',
            example: 'God so loved the world...'
        },
        scriptureReferences: {
            type: 'array',
            items: {
                $ref: '#/components/schemas/ScriptureReference'
            },
            description: 'Array of scripture references'
        },
        images: {
            type: 'array',
            items: {
                type: 'string',
                format: 'uri'
            },
            description: 'Array of image URLs'
        }
    }
};

export const updateNoteInputSchema = {
    type: 'object',
    properties: {
        title: {
            type: 'string',
            minLength: 1,
            description: 'Title of the note'
        },
        content: {
            type: 'string',
            description: 'Main content of the note'
        },
        scriptureReferences: {
            type: 'array',
            items: {
                $ref: '#/components/schemas/ScriptureReference'
            },
            description: 'Array of scripture references'
        },
        images: {
            type: 'array',
            items: {
                type: 'string',
                format: 'uri'
            },
            description: 'Array of image URLs'
        }
    }
};

export const successResponseSchema = {
    type: 'object',
    required: ['success'],
    properties: {
        success: {
            type: 'boolean',
            example: true
        }
    }
};

export const errorResponseSchema = {
    type: 'object',
    required: ['error', 'success'],
    properties: {
        error: {
            type: 'string',
            description: 'Error message'
        },
        success: {
            type: 'boolean',
            example: false
        }
    }
};

export const healthResponseSchema = {
    type: 'object',
    required: ['status', 'timestamp', 'version', 'database', 'uptime'],
    properties: {
        status: {
            type: 'string',
            enum: ['healthy', 'unhealthy'],
            description: 'Overall health status of the API',
            example: 'healthy'
        },
        timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO timestamp when the health check was performed'
        },
        version: {
            type: 'string',
            description: 'API version',
            example: '1.0.0'
        },
        database: {
            type: 'string',
            enum: ['connected', 'disconnected', 'unknown'],
            description: 'Database connection status',
            example: 'connected'
        },
        uptime: {
            type: 'number',
            description: 'Server uptime in seconds',
            example: 3600.5
        }
    }
};

// Export all schemas as a combined object for easy import
export const openApiSchemas = {
    ScriptureReference: scriptureReferenceSchema,
    Note: noteSchema,
    CreateNoteInput: createNoteInputSchema,
    UpdateNoteInput: updateNoteInputSchema,
    SuccessResponse: successResponseSchema,
    ErrorResponse: errorResponseSchema,
    HealthResponse: healthResponseSchema
};