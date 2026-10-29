
-- Extensions: uuid-ossp, vector (pgvector), pg_trgm

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CLIENTS TABLE
-- Organizations/Clients managing their own documents and users
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    website VARCHAR(255) DEFAULT '',
    created_by UUID,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{"dataRetentionDays": 30, "alertsEnabled": true, "timezone": "UTC"}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- USERS TABLE
-- Roles: super_admin (platform level), client_admin, client_viewer (client level)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'client_viewer', -- super_admin, client_admin, client_viewer
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE, -- NULL for super_admin
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{"canCreateApiKeys": false, "canManageUsers": false, "canViewAnalytics": true, "canExportData": false}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add self-referencing foreign key from clients.created_by to users(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_clients_created_by'
    ) THEN
        ALTER TABLE clients ADD CONSTRAINT fk_clients_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- API KEYS TABLE
-- Auto-generated keys for client services & document ingestion
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_id VARCHAR(100) UNIQUE NOT NULL,
    key_value VARCHAR(255) UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    environment VARCHAR(50) DEFAULT 'production', -- production, staging, development, testing
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{"canIngest": true, "canReadAnalytics": true}'::jsonb,
    security JSONB DEFAULT '{"allowedIPs": [], "allowedOrigins": ["*"]}'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '365 days'),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- DOCUMENTS TABLE
-- Scoped to client_id for multi-tenant data isolation and user_id
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE, -- Client / Tenant ownership
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,   -- Uploader / User account
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    page_count INT DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- EXTRACTED TEXT TABLE 
CREATE TABLE IF NOT EXISTS extracted_text (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number INT NOT NULL DEFAULT 1,
    raw_text TEXT NOT NULL,
    tsv_content TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', raw_text)) STORED,
    embedding vector(1536), -- text-embedding-3-small dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INVOICES TABLE 
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100),
    invoice_date DATE,
    supplier_name VARCHAR(255),
    customer_name VARCHAR(255),
    subtotal NUMERIC(15, 2),
    tax NUMERIC(15, 2),
    total NUMERIC(15, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    evidence_quotes JSONB,
    raw_ai_response JSONB,
    needs_review BOOLEAN DEFAULT FALSE,
    confidence_score NUMERIC(5, 4) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- LINE ITEMS TABLE
CREATE TABLE IF NOT EXISTS line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT,
    quantity NUMERIC(12, 4) DEFAULT 1,
    unit_price NUMERIC(15, 2) DEFAULT 0.00,
    total_amount NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- VALIDATION ERRORS TABLE
CREATE TABLE IF NOT EXISTS validation_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    error_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning', -- error, warning
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PROCESSING HISTORY TABLE 
CREATE TABLE IF NOT EXISTS processing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    stage VARCHAR(100) NOT NULL, -- upload, ocr_parsing, ai_extraction, validation, embedding
    status VARCHAR(50) NOT NULL,  -- started, completed, failed
    message TEXT,
    duration_ms INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES:
-- Clients Indexes
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);

-- Users Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);

-- API Keys Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_client_id ON api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON api_keys(key_value);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- Document Ownership & Multi-Tenancy Indexes
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Invoices Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_doc_id ON invoices(document_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_name);
CREATE INDEX IF NOT EXISTS idx_invoices_needs_review ON invoices(needs_review);

-- Line Items Index
CREATE INDEX IF NOT EXISTS idx_line_items_invoice_id ON line_items(invoice_id);

-- Validation Errors Index
CREATE INDEX IF NOT EXISTS idx_validation_errors_doc_id ON validation_errors(document_id);

-- Processing History Index
CREATE INDEX IF NOT EXISTS idx_proc_hist_doc_id ON processing_history(document_id);

-- Full-Text Search (FTS) GIN Index
CREATE INDEX IF NOT EXISTS idx_extracted_text_tsv ON extracted_text USING GIN(tsv_content);

-- pgvector HNSW Index (Cosine Similarity for 1536-dim vector embeddings)
CREATE INDEX IF NOT EXISTS idx_extracted_text_embedding ON extracted_text USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
