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
    required: ['status', 'timestamp', 'version', 'database', 'redis', 'uptime', 'environment'],
    properties: {
        status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
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
            description: 'API semantic version',
            example: '1.2.3'
        },
        database: {
            type: 'string',
            enum: ['connected', 'disconnected', 'unknown'],
            description: 'Database connection status',
            example: 'connected'
        },
        redis: {
            type: 'string',
            enum: ['connected', 'disconnected', 'in-memory', 'unknown'],
            description: 'Redis cache connection status',
            example: 'connected'
        },
        uptime: {
            type: 'number',
            description: 'Server uptime in seconds',
            example: 3600.5
        },
        environment: {
            type: 'string',
            enum: ['development', 'staging', 'production', 'test'],
            description: 'Current environment',
            example: 'production'
        },
        buildDate: {
            type: 'string',
            format: 'date-time',
            description: 'Build timestamp',
            nullable: true
        },
        commitSha: {
            type: 'string',
            description: 'Git commit SHA of the build',
            example: 'a1b2c3d4',
            nullable: true
        }
    }
};

export const addressSchema = {
    type: 'object',
    properties: {
        street: {
            type: 'string',
            description: 'Street address',
            example: '123 Main St'
        },
        city: {
            type: 'string',
            description: 'City name',
            example: 'Springfield'
        },
        state: {
            type: 'string',
            description: 'State or province',
            example: 'IL'
        },
        zipCode: {
            type: 'string',
            description: 'ZIP or postal code',
            example: '62701'
        },
        country: {
            type: 'string',
            description: 'Country name',
            example: 'USA'
        }
    }
};

export const socialLinksSchema = {
    type: 'object',
    properties: {
        facebook: {
            type: 'string',
            format: 'uri',
            description: 'Facebook page URL',
            example: 'https://facebook.com/church'
        },
        instagram: {
            type: 'string',
            format: 'uri',
            description: 'Instagram page URL',
            example: 'https://instagram.com/church'
        },
        twitterX: {
            type: 'string',
            format: 'uri',
            description: 'Twitter/X page URL',
            example: 'https://twitter.com/church'
        },
        youtube: {
            type: 'string',
            format: 'uri',
            description: 'YouTube channel URL',
            example: 'https://youtube.com/church'
        },
        tiktok: {
            type: 'string',
            format: 'uri',
            description: 'TikTok page URL',
            example: 'https://tiktok.com/@church'
        },
        other: {
            type: 'array',
            items: {
                type: 'string',
                format: 'uri'
            },
            description: 'Other social media URLs'
        }
    }
};

export const churchSchema = {
    type: 'object',
    required: ['id', 'slug', 'name', 'approvalStatus', 'createdBy', 'createdAt', 'updatedAt', 'version', 'visibility'],
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the church'
        },
        slug: {
            type: 'string',
            description: 'URL-friendly church identifier',
            example: 'grace-community-church'
        },
        name: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            description: 'Church name',
            example: 'Grace Community Church'
        },
        description: {
            type: 'string',
            maxLength: 2000,
            description: 'Church description',
            nullable: true,
            example: 'A welcoming church community'
        },
        logoUrl: {
            type: 'string',
            format: 'uri',
            description: 'Church logo URL',
            nullable: true,
            example: 'https://example.com/logo.png'
        },
        coverImageUrl: {
            type: 'string',
            format: 'uri',
            description: 'Church cover image URL',
            nullable: true,
            example: 'https://example.com/cover.jpg'
        },
        byline: {
            type: 'string',
            maxLength: 160,
            description: 'Short church tagline',
            nullable: true,
            example: 'Where faith meets community'
        },
        missionStatement: {
            type: 'string',
            maxLength: 2000,
            description: 'Church mission statement',
            nullable: true,
            example: 'To spread love and serve our community'
        },
        address: {
            allOf: [{ $ref: '#/components/schemas/Address' }],
            nullable: true
        },
        latitude: {
            type: 'number',
            minimum: -90,
            maximum: 90,
            description: 'Church location latitude',
            nullable: true,
            example: 39.7817
        },
        longitude: {
            type: 'number',
            minimum: -180,
            maximum: 180,
            description: 'Church location longitude',
            nullable: true,
            example: -89.6501
        },
        email: {
            type: 'string',
            format: 'email',
            description: 'Church contact email',
            nullable: true,
            example: 'info@church.org'
        },
        phoneNumber: {
            type: 'string',
            description: 'Church contact phone',
            nullable: true,
            example: '+1-555-0123'
        },
        websiteUrl: {
            type: 'string',
            format: 'uri',
            description: 'Church website URL',
            nullable: true,
            example: 'https://church.org'
        },
        socialLinks: {
            allOf: [{ $ref: '#/components/schemas/SocialLinks' }],
            nullable: true
        },
        approvalStatus: {
            type: 'string',
            enum: ['Pending', 'Approved', 'Rejected'],
            description: 'Church approval status'
        },
        visibility: {
            type: 'string',
            enum: ['Public', 'Hidden'],
            description: 'Church visibility setting'
        },
        createdBy: {
            type: 'string',
            format: 'uuid',
            description: 'ID of user who created the church'
        },
        createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the church was created'
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the church was last updated'
        },
        version: {
            type: 'integer',
            minimum: 1,
            description: 'Church record version for optimistic locking'
        }
    }
};

export const createChurchInputSchema = {
    type: 'object',
    required: ['name'],
    properties: {
        name: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            description: 'Church name',
            example: 'Grace Community Church'
        },
        description: {
            type: 'string',
            maxLength: 2000,
            description: 'Church description',
            example: 'A welcoming church community'
        },
        logoUrl: {
            type: 'string',
            format: 'uri',
            description: 'Church logo URL',
            example: 'https://example.com/logo.png'
        },
        coverImageUrl: {
            type: 'string',
            format: 'uri',
            description: 'Church cover image URL',
            example: 'https://example.com/cover.jpg'
        },
        byline: {
            type: 'string',
            maxLength: 160,
            description: 'Short church tagline',
            example: 'Where faith meets community'
        },
        missionStatement: {
            type: 'string',
            maxLength: 2000,
            description: 'Church mission statement',
            example: 'To spread love and serve our community'
        },
        address: {
            $ref: '#/components/schemas/Address'
        },
        latitude: {
            type: 'number',
            minimum: -90,
            maximum: 90,
            description: 'Church location latitude',
            example: 39.7817
        },
        longitude: {
            type: 'number',
            minimum: -180,
            maximum: 180,
            description: 'Church location longitude',
            example: -89.6501
        },
        email: {
            type: 'string',
            format: 'email',
            description: 'Church contact email',
            example: 'info@church.org'
        },
        phoneNumber: {
            type: 'string',
            description: 'Church contact phone',
            example: '+1-555-0123'
        },
        websiteUrl: {
            type: 'string',
            format: 'uri',
            description: 'Church website URL',
            example: 'https://church.org'
        },
        socialLinks: {
            $ref: '#/components/schemas/SocialLinks'
        }
    }
};

export const churchMemberSchema = {
    type: 'object',
    required: ['id', 'churchId', 'userId', 'role', 'status', 'joinedAt', 'updatedAt'],
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the membership'
        },
        churchId: {
            type: 'string',
            format: 'uuid',
            description: 'Church ID'
        },
        userId: {
            type: 'string',
            format: 'uuid',
            description: 'User ID'
        },
        role: {
            type: 'string',
            enum: ['Owner', 'Manager', 'Member'],
            description: 'Member role in the church'
        },
        status: {
            type: 'string',
            enum: ['Active', 'Invited', 'Removed', 'Banned'],
            description: 'Member status'
        },
        joinedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the member joined'
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the membership was last updated'
        },
        invitedBy: {
            type: 'string',
            format: 'uuid',
            description: 'ID of user who sent the invitation',
            nullable: true
        },
        invitedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the invitation was sent',
            nullable: true
        }
    }
};

export const invitationInputSchema = {
    type: 'object',
    required: ['userId'],
    properties: {
        userId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of user to invite'
        },
        role: {
            type: 'string',
            enum: ['Manager', 'Member'],
            default: 'Member',
            description: 'Role to assign to the invited user'
        }
    }
};

export const updateRoleInputSchema = {
    type: 'object',
    required: ['role'],
    properties: {
        role: {
            type: 'string',
            enum: ['Owner', 'Manager', 'Member'],
            description: 'New role for the member'
        }
    }
};

export const mediaSchema = {
    type: 'object',
    required: ['id', 'filename', 'originalFilename', 'mimeType', 'fileSize', 'uploadedBy', 'createdAt', 'updatedAt'],
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the media record'
        },
        filename: {
            type: 'string',
            minLength: 1,
            description: 'Sanitized filename used in URLs',
            example: 'document_20240924_123456.pdf'
        },
        originalFilename: {
            type: 'string',
            minLength: 1,
            description: 'Original filename as uploaded by user',
            example: 'My Document.pdf'
        },
        mimeType: {
            type: 'string',
            minLength: 1,
            description: 'MIME type of the uploaded file',
            example: 'application/pdf'
        },
        fileSize: {
            type: 'integer',
            minimum: 1,
            description: 'Size of the file in bytes',
            example: 1048576
        },
        uploadedBy: {
            type: 'string',
            format: 'uuid',
            description: 'UUID of the user who uploaded the file'
        },
        createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the record was created'
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the record was last updated'
        }
    }
};

export const postSchema = {
    type: 'object',
    required: ['id', 'title', 'content', 'authorId', 'churchId', 'status', 'publishedAt', 'image', 'tags', 'categories', 'scriptureReferences', 'seriesId', 'seriesName', 'createdAt', 'updatedAt'],
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the post'
        },
        title: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Post title',
            example: 'Morning Devotional: Finding Peace'
        },
        content: {
            type: 'string',
            minLength: 1,
            description: 'Post content',
            example: 'In times of trouble, we can find peace...'
        },
        authorId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the user who created the post'
        },
        churchId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the church this post belongs to'
        },
        status: {
            type: 'string',
            enum: ['draft', 'published'],
            description: 'Publication status of the post'
        },
        publishedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'When the post was published'
        },
        image: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description: 'URL of the post image',
            example: 'https://example.com/image.jpg'
        },
        tags: {
            type: 'array',
            items: {
                type: 'string'
            },
            description: 'Tags associated with the post',
            example: ['devotional', 'prayer']
        },
        categories: {
            type: 'array',
            items: {
                type: 'string'
            },
            description: 'Categories the post belongs to',
            example: ['spiritual growth', 'worship']
        },
        scriptureReferences: {
            type: 'array',
            items: {
                $ref: '#/components/schemas/ScriptureReference'
            },
            description: 'Scripture references cited in the post'
        },
        seriesId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'ID of the series this post belongs to'
        },
        seriesName: {
            type: 'string',
            nullable: true,
            description: 'Name of the series this post belongs to',
            example: 'Daily Bread'
        },
        createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the post was created'
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the post was last updated'
        }
    }
};

export const createPostInputSchema = {
    type: 'object',
    required: ['title', 'content', 'churchId'],
    properties: {
        title: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Post title',
            example: 'Morning Devotional: Finding Peace'
        },
        content: {
            type: 'string',
            minLength: 1,
            description: 'Post content',
            example: 'In times of trouble, we can find peace...'
        },
        churchId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the church this post belongs to'
        },
        image: {
            type: 'string',
            format: 'uri',
            description: 'URL of the post image',
            example: 'https://example.com/image.jpg'
        },
        tags: {
            type: 'array',
            items: {
                type: 'string'
            },
            description: 'Tags to associate with the post',
            example: ['devotional', 'prayer']
        },
        categories: {
            type: 'array',
            items: {
                type: 'string'
            },
            description: 'Categories the post belongs to',
            example: ['spiritual growth', 'worship']
        },
        scriptureReferences: {
            type: 'array',
            items: {
                $ref: '#/components/schemas/ScriptureReference'
            },
            description: 'Scripture references to cite in the post'
        },
        seriesId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the series this post belongs to'
        },
        seriesName: {
            type: 'string',
            description: 'Name of the series this post belongs to',
            example: 'Daily Bread'
        }
    }
};

export const updatePostInputSchema = {
    type: 'object',
    properties: {
        title: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Post title'
        },
        content: {
            type: 'string',
            minLength: 1,
            description: 'Post content'
        },
        status: {
            type: 'string',
            enum: ['draft', 'published'],
            description: 'Publication status'
        },
        image: {
            type: 'string',
            format: 'uri',
            description: 'URL of the post image'
        },
        tags: {
            type: 'array',
            items: {
                type: 'string'
            },
            description: 'Tags to associate with the post'
        },
        categories: {
            type: 'array',
            items: {
                type: 'string'
            },
            description: 'Categories the post belongs to'
        },
        scriptureReferences: {
            type: 'array',
            items: {
                $ref: '#/components/schemas/ScriptureReference'
            },
            description: 'Scripture references'
        },
        seriesId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the series'
        },
        seriesName: {
            type: 'string',
            description: 'Name of the series'
        }
    }
};

export const seriesSchema = {
    type: 'object',
    required: ['id', 'title', 'description', 'authorId', 'churchId', 'status', 'createdAt', 'updatedAt'],
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the series',
            example: '550e8400-e29b-41d4-a716-446655440000'
        },
        title: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Title of the devotional series',
            example: 'Morning Devotionals'
        },
        description: {
            type: 'string',
            minLength: 1,
            description: 'Description of the devotional series',
            example: 'Daily morning reflections and prayers to start your day'
        },
        image: {
            type: 'string',
            nullable: true,
            format: 'uri',
            description: 'URL to the series cover image',
            example: 'https://example.com/devotional-cover.jpg'
        },
        authorId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the author who created the series',
            example: '550e8400-e29b-41d4-a716-446655440001'
        },
        churchId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the church this series belongs to',
            example: '550e8400-e29b-41d4-a716-446655440002'
        },
        status: {
            type: 'string',
            enum: ['draft', 'published'],
            description: 'Publication status of the series',
            example: 'draft'
        },
        publishedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Timestamp when the series was published',
            example: '2024-01-15T10:30:00Z'
        },
        createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the series was created',
            example: '2024-01-15T10:00:00Z'
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the series was last updated',
            example: '2024-01-15T10:30:00Z'
        }
    }
};

export const createSeriesInputSchema = {
    type: 'object',
    required: ['title', 'description', 'churchId'],
    properties: {
        title: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Title of the devotional series',
            example: 'Morning Devotionals'
        },
        description: {
            type: 'string',
            minLength: 1,
            description: 'Description of the devotional series',
            example: 'Daily morning reflections and prayers to start your day'
        },
        churchId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the church this series belongs to',
            example: '550e8400-e29b-41d4-a716-446655440001'
        },
        image: {
            type: 'string',
            format: 'uri',
            description: 'Optional URL to the series cover image',
            example: 'https://example.com/devotional-cover.jpg'
        }
    }
};

export const updateSeriesInputSchema = {
    type: 'object',
    properties: {
        title: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Updated title of the devotional series',
            example: 'Evening Devotionals'
        },
        description: {
            type: 'string',
            minLength: 1,
            description: 'Updated description of the devotional series',
            example: 'Peaceful reflections for the evening'
        },
        status: {
            type: 'string',
            enum: ['draft', 'published'],
            description: 'Updated publication status',
            example: 'published'
        },
        image: {
            type: 'string',
            format: 'uri',
            description: 'Updated URL to the series cover image',
            example: 'https://example.com/new-cover.jpg'
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
    HealthResponse: healthResponseSchema,
    Address: addressSchema,
    SocialLinks: socialLinksSchema,
    Church: churchSchema,
    CreateChurchInput: createChurchInputSchema,
    ChurchMember: churchMemberSchema,
    InvitationInput: invitationInputSchema,
    UpdateRoleInput: updateRoleInputSchema,
    Media: mediaSchema,
    Post: postSchema,
    CreatePostInput: createPostInputSchema,
    UpdatePostInput: updatePostInputSchema,
    Series: seriesSchema,
    CreateSeriesInput: createSeriesInputSchema,
    UpdateSeriesInput: updateSeriesInputSchema
};