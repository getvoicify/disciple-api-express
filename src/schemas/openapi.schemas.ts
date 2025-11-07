/**
 * OpenAPI schema definitions for the Disciple API
 * These schemas are used in the Swagger documentation
 */

/**
 * Embedded User Info Schema
 *
 * This schema represents user information that is embedded in entity responses
 * (posts, prayers, notes, series) to reduce the need for separate API calls.
 *
 * Features:
 * - Automatically fetched and cached for performance
 * - Privacy-aware (filters fields based on user privacy settings)
 * - Optional field (backward compatible)
 * - For anonymous prayers, this field is omitted entirely
 *
 * Cache Behavior:
 * - User info is cached for 15 minutes (configurable via USER_PROFILE_CACHE_TTL)
 * - Cache hit rate typically >70%
 * - Batch fetching prevents N+1 query problems
 */
export const userInfoSchema = {
    type: 'object',
    properties: {
        userId: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the user'
        },
        firstName: {
            type: 'string',
            description: 'User\'s first name',
            example: 'John'
        },
        lastName: {
            type: 'string',
            description: 'User\'s last name',
            example: 'Doe'
        },
        displayName: {
            type: 'string',
            description: 'User\'s display name (typically firstName + lastName)',
            example: 'John Doe'
        },
        avatarUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description: 'URL to user\'s avatar image',
            example: 'https://example.com/avatars/user123.jpg'
        },
        email: {
            type: 'string',
            format: 'email',
            nullable: true,
            description: 'User\'s email address (may be filtered based on privacy settings)',
            example: 'john.doe@example.com'
        }
    },
    description: 'Embedded user information to reduce API calls and improve performance'
};

/**
 * Embedded Church Info Schema
 *
 * This schema represents church information that is embedded in entity responses
 * (posts, prayer walls, series) to reduce the need for separate API calls.
 *
 * Features:
 * - Automatically fetched and cached for performance
 * - Optional field (backward compatible)
 * - Contains essential church details for display
 *
 * Cache Behavior:
 * - Church info is cached for 1 hour (configurable via CHURCH_INFO_CACHE_TTL)
 * - Cache hit rate typically >80%
 * - Batch fetching prevents N+1 query problems
 */
export const churchInfoSchema = {
    type: 'object',
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
            description: 'Church name',
            example: 'Grace Community Church'
        },
        description: {
            type: 'string',
            nullable: true,
            description: 'Church description',
            example: 'A welcoming church community'
        },
        logoUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            description: 'URL to church logo image',
            example: 'https://example.com/logo.jpg'
        },
        byline: {
            type: 'string',
            nullable: true,
            description: 'Short church tagline',
            example: 'Where faith meets community'
        }
    },
    description: 'Embedded church information to reduce API calls and improve performance'
};

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
        },
        ownerId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the user who owns this note (maintained for backward compatibility)'
        },
        owner: {
            $ref: '#/components/schemas/UserInfo',
            description: 'Embedded owner information (optional, improves performance by reducing API calls)'
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
            description: 'Church ID (maintained for backward compatibility)'
        },
        church: {
            $ref: '#/components/schemas/ChurchInfo',
            description: 'Embedded church information (optional, improves performance by reducing API calls)'
        },
        userId: {
            type: 'string',
            format: 'uuid',
            description: 'User ID (maintained for backward compatibility)'
        },
        user: {
            $ref: '#/components/schemas/UserInfo',
            description: 'Embedded user information (optional, improves performance by reducing API calls)'
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
            description: 'ID of the user who created the post (maintained for backward compatibility)'
        },
        author: {
            $ref: '#/components/schemas/UserInfo',
            description: 'Embedded author information (optional, improves performance by reducing API calls)'
        },
        churchId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the church this post belongs to (maintained for backward compatibility)'
        },
        church: {
            $ref: '#/components/schemas/ChurchInfo',
            description: 'Embedded church information (optional, improves performance by reducing API calls)'
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
            description: 'ID of the author who created the series (maintained for backward compatibility)',
            example: '550e8400-e29b-41d4-a716-446655440001'
        },
        author: {
            $ref: '#/components/schemas/UserInfo',
            description: 'Embedded author information (optional, improves performance by reducing API calls)'
        },
        churchId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the church this series belongs to (maintained for backward compatibility)',
            example: '550e8400-e29b-41d4-a716-446655440002'
        },
        church: {
            $ref: '#/components/schemas/ChurchInfo',
            description: 'Embedded church information (optional, improves performance by reducing API calls)'
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

export const privacyModeSchema = {
    type: 'string',
    enum: ['public', 'church_only', 'private'],
    description: 'Privacy mode for profile visibility',
    example: 'church_only'
};

export const fieldVisibilitySettingsSchema = {
    type: 'object',
    additionalProperties: {
        type: 'boolean'
    },
    description: 'Field-level visibility settings mapping field names to visibility (true = visible, false = hidden)',
    example: {
        bio: true,
        testimony: false,
        profilePhotoMediaId: true
    }
};

export const notificationPreferencesSchema = {
    type: 'object',
    properties: {
        emailEnabled: {
            type: 'boolean',
            description: 'Enable email notifications',
            example: true
        },
        pushEnabled: {
            type: 'boolean',
            description: 'Enable push notifications',
            example: true
        }
    },
    description: 'User notification preferences'
};

export const cachedMetricsSchema = {
    type: 'object',
    properties: {
        notesCount: {
            type: 'integer',
            minimum: 0,
            description: 'Cached count of user notes',
            example: 42
        },
        prayersCount: {
            type: 'integer',
            minimum: 0,
            description: 'Cached count of user prayers',
            example: 18
        },
        devotionalsCount: {
            type: 'integer',
            minimum: 0,
            description: 'Cached count of user devotionals',
            example: 7
        },
        daysActive: {
            type: 'integer',
            minimum: 0,
            description: 'Cached count of days user has been active',
            example: 30
        },
        lastCalculated: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when metrics were last calculated',
            example: '2024-01-15T10:30:00Z'
        }
    },
    description: 'Cached user engagement metrics'
};

export const profileSchema = {
    type: 'object',
    required: ['userId', 'privacyMode', 'createdAt', 'updatedAt'],
    properties: {
        userId: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the user',
            example: '550e8400-e29b-41d4-a716-446655440000'
        },
        bio: {
            type: 'string',
            maxLength: 5000,
            nullable: true,
            description: 'User biography',
            example: 'Member of the church since 2020'
        },
        testimony: {
            type: 'string',
            maxLength: 5000,
            nullable: true,
            description: 'User testimony',
            example: 'God changed my life in amazing ways...'
        },
        profilePhotoMediaId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'ID of the media record for profile photo',
            example: '550e8400-e29b-41d4-a716-446655440001'
        },
        privacyMode: {
            $ref: '#/components/schemas/PrivacyMode'
        },
        fieldVisibilitySettings: {
            $ref: '#/components/schemas/FieldVisibilitySettings'
        },
        cachedMetrics: {
            $ref: '#/components/schemas/CachedMetrics'
        },
        notificationPreferences: {
            $ref: '#/components/schemas/NotificationPreferences'
        },
        preferredDevotionalTime: {
            type: 'string',
            pattern: '^\\d{2}:\\d{2}:\\d{2}$',
            nullable: true,
            description: 'Preferred devotional time in HH:MM:SS format',
            example: '07:00:00'
        },
        createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the profile was created'
        },
        updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the profile was last updated'
        }
    }
};

export const createProfileInputSchema = {
    type: 'object',
    properties: {
        bio: {
            type: 'string',
            maxLength: 5000,
            description: 'User biography',
            example: 'Member of the church since 2020'
        },
        testimony: {
            type: 'string',
            maxLength: 5000,
            description: 'User testimony',
            example: 'God changed my life in amazing ways...'
        },
        profilePhotoMediaId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the media record for profile photo',
            example: '550e8400-e29b-41d4-a716-446655440001'
        },
        privacyMode: {
            $ref: '#/components/schemas/PrivacyMode'
        },
        fieldVisibilitySettings: {
            $ref: '#/components/schemas/FieldVisibilitySettings'
        },
        notificationPreferences: {
            $ref: '#/components/schemas/NotificationPreferences'
        },
        preferredDevotionalTime: {
            type: 'string',
            pattern: '^\\d{2}:\\d{2}:\\d{2}$',
            description: 'Preferred devotional time in HH:MM:SS format',
            example: '07:00:00'
        }
    }
};

export const updateProfileInputSchema = {
    type: 'object',
    properties: {
        bio: {
            type: 'string',
            maxLength: 5000,
            description: 'User biography',
            example: 'Updated biography'
        },
        testimony: {
            type: 'string',
            maxLength: 5000,
            description: 'User testimony',
            example: 'Updated testimony'
        },
        profilePhotoMediaId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'ID of the media record for profile photo (null to remove)',
            example: '550e8400-e29b-41d4-a716-446655440001'
        },
        privacyMode: {
            $ref: '#/components/schemas/PrivacyMode'
        },
        fieldVisibilitySettings: {
            $ref: '#/components/schemas/FieldVisibilitySettings'
        },
        notificationPreferences: {
            $ref: '#/components/schemas/NotificationPreferences'
        },
        preferredDevotionalTime: {
            type: 'string',
            pattern: '^\\d{2}:\\d{2}:\\d{2}$',
            nullable: true,
            description: 'Preferred devotional time in HH:MM:SS format (null to remove)',
            example: '08:00:00'
        }
    }
};

export const profileStatisticsSchema = {
    type: 'object',
    required: ['notesCount', 'prayersCount', 'devotionalsCount'],
    properties: {
        notesCount: {
            type: 'integer',
            minimum: 0,
            description: 'Total count of user notes',
            example: 42
        },
        prayersCount: {
            type: 'integer',
            minimum: 0,
            description: 'Total count of user prayers',
            example: 18
        },
        devotionalsCount: {
            type: 'integer',
            minimum: 0,
            description: 'Total count of user devotionals',
            example: 7
        },
        daysActive: {
            type: 'integer',
            minimum: 0,
            description: 'Total days user has been active',
            example: 30
        }
    }
};

export const dashboardDataSchema = {
    type: 'object',
    required: ['recentNotes', 'activePrayerRequests', 'devotionalProgress', 'statistics'],
    properties: {
        recentNotes: {
            type: 'array',
            items: {
                type: 'object',
                required: ['id', 'content', 'createdAt', 'updatedAt'],
                properties: {
                    id: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Note ID'
                    },
                    title: {
                        type: 'string',
                        nullable: true,
                        description: 'Note title'
                    },
                    content: {
                        type: 'string',
                        description: 'Note content'
                    },
                    createdAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Note creation timestamp'
                    },
                    updatedAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Note last update timestamp'
                    }
                }
            },
            description: 'Recent notes (up to 10 most recent)'
        },
        activePrayerRequests: {
            type: 'array',
            items: {
                type: 'object',
                required: ['id', 'title', 'status', 'createdAt', 'updatedAt'],
                properties: {
                    id: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Prayer request ID'
                    },
                    title: {
                        type: 'string',
                        description: 'Prayer request title'
                    },
                    description: {
                        type: 'string',
                        nullable: true,
                        description: 'Prayer request description'
                    },
                    status: {
                        type: 'string',
                        enum: ['active', 'ongoing'],
                        description: 'Prayer request status'
                    },
                    createdAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Prayer request creation timestamp'
                    },
                    updatedAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Prayer request last update timestamp'
                    }
                }
            },
            description: 'Active prayer requests (up to 10 most recent)'
        },
        devotionalProgress: {
            type: 'array',
            items: {
                type: 'object',
                required: ['seriesId', 'seriesName', 'postId', 'postTitle', 'publishedAt'],
                properties: {
                    seriesId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Devotional series ID'
                    },
                    seriesName: {
                        type: 'string',
                        description: 'Devotional series name'
                    },
                    postId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Devotional post ID'
                    },
                    postTitle: {
                        type: 'string',
                        description: 'Devotional post title'
                    },
                    publishedAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Post publication timestamp'
                    }
                }
            },
            description: 'Recent devotional progress (up to 10 most recent published posts)'
        },
        statistics: {
            $ref: '#/components/schemas/ProfileStatistics'
        }
    }
};

export const wallStatusSchema = {
    type: 'string',
    enum: ['active', 'archived'],
    description: 'Prayer wall status',
    example: 'active'
};

export const anonymityLevelSchema = {
    type: 'string',
    enum: ['identified', 'anonymous_to_members', 'fully_anonymous'],
    description: 'Anonymity level for prayer requests',
    example: 'identified'
};

export const prayerWallScheduleSchema = {
    type: 'object',
    properties: {
        frequency: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
            description: 'Frequency of recurring prayer meetings',
            example: 'weekly'
        },
        day: {
            type: 'string',
            description: 'Day of the week for meetings (e.g., "Saturday", "Monday")',
            example: 'Saturday'
        },
        time: {
            type: 'string',
            pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$',
            description: 'Time of day in HH:MM format',
            example: '06:00'
        },
        timezone: {
            type: 'string',
            description: 'IANA timezone identifier',
            example: 'Africa/Lagos'
        },
        duration_minutes: {
            type: 'integer',
            minimum: 1,
            description: 'Duration of meeting in minutes',
            example: 60
        },
        end_time: {
            type: 'string',
            pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$',
            description: 'End time in HH:MM format',
            example: '07:00'
        }
    },
    required: ['frequency', 'time', 'timezone'],
    description: 'Schedule configuration for recurring prayer meetings'
};

export const prayerWallSchema = {
    type: 'object',
    required: ['id', 'church_id', 'name', 'created_by', 'is_private', 'has_restricted_access', 'status', 'created_at', 'updated_at'],
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the prayer wall',
            example: '550e8400-e29b-41d4-a716-446655440000'
        },
        church_id: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the church this wall belongs to (maintained for backward compatibility)',
            example: '550e8400-e29b-41d4-a716-446655440001'
        },
        church: {
            $ref: '#/components/schemas/ChurchInfo',
            description: 'Embedded church information (optional, improves performance by reducing API calls)'
        },
        name: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Name of the prayer wall',
            example: 'Youth Prayer Circle'
        },
        description: {
            type: 'string',
            maxLength: 2000,
            nullable: true,
            description: 'Description of the prayer wall',
            example: 'Weekly prayer gathering for youth'
        },
        created_by: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the user who created the wall',
            example: '550e8400-e29b-41d4-a716-446655440002'
        },
        is_private: {
            type: 'boolean',
            description: 'Whether the wall is private (pastor-only creation)',
            example: false
        },
        has_restricted_access: {
            type: 'boolean',
            description: 'Whether the wall requires invitation to join',
            example: false
        },
        schedule: {
            allOf: [{ $ref: '#/components/schemas/PrayerWallSchedule' }],
            nullable: true
        },
        video_call_link: {
            type: 'string',
            format: 'uri',
            maxLength: 500,
            nullable: true,
            description: 'Video call link for prayer meetings',
            example: 'https://zoom.us/j/123456789'
        },
        status: {
            $ref: '#/components/schemas/WallStatus'
        },
        created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the wall was created'
        },
        updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the wall was last updated'
        },
        deleted_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Timestamp when the wall was deleted (soft delete)'
        }
    }
};

export const prayerRequestSchema = {
    type: 'object',
    required: ['id', 'wall_id', 'author_id', 'thread_depth', 'content', 'anonymity_level', 'has_attachment', 'created_at', 'updated_at'],
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the prayer request',
            example: '550e8400-e29b-41d4-a716-446655440000'
        },
        wall_id: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the prayer wall this request belongs to',
            example: '550e8400-e29b-41d4-a716-446655440001'
        },
        author_id: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the user who created the request (maintained for backward compatibility)',
            example: '550e8400-e29b-41d4-a716-446655440002'
        },
        author: {
            $ref: '#/components/schemas/UserInfo',
            description: 'Embedded author information (optional). NOTE: This field is OMITTED for prayers with anonymity_level set to "fully_anonymous" to protect user privacy. For "anonymous_to_members" prayers, this field may be filtered based on viewer permissions.'
        },
        parent_id: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'ID of parent prayer if this is a response (threaded reply)',
            example: '550e8400-e29b-41d4-a716-446655440003'
        },
        thread_depth: {
            type: 'integer',
            minimum: 0,
            maximum: 3,
            description: 'Depth of the thread (0 for root, max 3 for nested responses)',
            example: 0
        },
        content: {
            type: 'string',
            minLength: 10,
            maxLength: 5000,
            description: 'Content of the prayer request',
            example: 'Please pray for my family during this difficult time.'
        },
        anonymity_level: {
            $ref: '#/components/schemas/AnonymityLevel'
        },
        has_attachment: {
            type: 'boolean',
            description: 'Whether the prayer has file attachments',
            example: false
        },
        created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the prayer was created'
        },
        updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the prayer was last updated'
        },
        deleted_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Timestamp when the prayer was deleted (soft delete)'
        },
        deleted_by: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'ID of user who deleted the prayer'
        }
    }
};

export const prayerWallMembershipSchema = {
    type: 'object',
    required: ['id', 'wall_id', 'user_id', 'joined_at', 'is_banned', 'created_at', 'updated_at'],
    properties: {
        id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the membership',
            example: '550e8400-e29b-41d4-a716-446655440000'
        },
        wall_id: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the prayer wall',
            example: '550e8400-e29b-41d4-a716-446655440001'
        },
        user_id: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the user member (maintained for backward compatibility)',
            example: '550e8400-e29b-41d4-a716-446655440002'
        },
        user: {
            $ref: '#/components/schemas/UserInfo',
            description: 'Embedded user information (optional, improves performance by reducing API calls)'
        },
        joined_at: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the user joined the wall'
        },
        invited_by: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'ID of the user who sent the invitation',
            example: '550e8400-e29b-41d4-a716-446655440003'
        },
        left_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Timestamp when the user left the wall'
        },
        is_banned: {
            type: 'boolean',
            description: 'Whether the user is banned from the wall',
            example: false
        },
        banned_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'Timestamp when the user was banned'
        },
        banned_by: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'ID of the user who banned this member'
        },
        created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the membership was created'
        },
        updated_at: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the membership was last updated'
        }
    }
};

// Export all schemas as a combined object for easy import
export const openApiSchemas = {
    UserInfo: userInfoSchema,
    ChurchInfo: churchInfoSchema,
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
    UpdateSeriesInput: updateSeriesInputSchema,
    PrivacyMode: privacyModeSchema,
    FieldVisibilitySettings: fieldVisibilitySettingsSchema,
    NotificationPreferences: notificationPreferencesSchema,
    CachedMetrics: cachedMetricsSchema,
    Profile: profileSchema,
    CreateProfileInput: createProfileInputSchema,
    UpdateProfileInput: updateProfileInputSchema,
    ProfileStatistics: profileStatisticsSchema,
    DashboardData: dashboardDataSchema,
    WallStatus: wallStatusSchema,
    AnonymityLevel: anonymityLevelSchema,
    PrayerWallSchedule: prayerWallScheduleSchema,
    PrayerWall: prayerWallSchema,
    PrayerWallMembership: prayerWallMembershipSchema,
    PrayerRequest: prayerRequestSchema
};