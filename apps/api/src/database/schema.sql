-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Enum Types
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('student', 'lecturer', 'ta', 'club_lead', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status_enum AS ENUM ('active', 'suspended', 'pending_verification');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE post_type_enum AS ENUM ('general', 'question', 'resource_share', 'pbl_recruitment', 'announcement');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reaction_type_enum AS ENUM ('like', 'helpful', 'insightful', 'celebrate');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE doc_type_enum AS ENUM ('midterm_exam', 'final_exam', 'lecture_slide', 'syllabus', 'sample_project', 'internship_report', 'scientific_paper');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE group_status_enum AS ENUM ('recruiting', 'active', 'completed', 'disbanded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE group_type_enum AS ENUM ('pbl_project', 'capstone', 'exam_prep', 'hackathon', 'research');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE group_member_role_enum AS ENUM ('leader', 'sub_leader', 'member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Academic Hierarchy
CREATE TABLE IF NOT EXISTS faculties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50),
    description TEXT,
    logo_url VARCHAR(500),
    dean_name VARCHAR(100),
    office_location VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    credits INT NOT NULL CHECK (credits > 0),
    faculty_id UUID REFERENCES faculties(id) ON DELETE SET NULL,
    faculty_code VARCHAR(20),
    description TEXT,
    syllabus_url VARCHAR(500),
    rating_avg NUMERIC(3,2) DEFAULT 5.00,
    document_count INT DEFAULT 0,
    post_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users & Profiles
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(20),
    faculty VARCHAR(50),
    academic_year VARCHAR(20),
    avatar_url VARCHAR(500),
    bio VARCHAR(250),
    role user_role_enum DEFAULT 'student',
    status account_status_enum DEFAULT 'active',
    reputation_points INT DEFAULT 100,
    is_onboarded BOOLEAN DEFAULT FALSE,
    skills TEXT[] DEFAULT '{}',
    interests TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Social Posts & Discussions
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    post_type post_type_enum DEFAULT 'general',
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(300) UNIQUE,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    media_urls TEXT[] DEFAULT '{}',
    attached_document_ids TEXT[] DEFAULT '{}',
    visibility VARCHAR(20) DEFAULT 'public',
    is_pinned BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    shares_count INT DEFAULT 0,
    views_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_reactions (
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reaction reaction_type_enum DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    is_solution BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Knowledge Hub & Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    doc_type doc_type_enum DEFAULT 'lecture_slide',
    type VARCHAR(50) DEFAULT 'pdf',
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(300) UNIQUE,
    description TEXT,
    file_url VARCHAR(1000) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    tags TEXT[] DEFAULT '{}',
    visibility VARCHAR(20) DEFAULT 'public',
    download_count INT DEFAULT 0,
    view_count INT DEFAULT 0,
    rating_avg NUMERIC(3,2) DEFAULT 5.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content_text TEXT NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

-- 5. Study Groups & PBL Matchmaking
CREATE TABLE IF NOT EXISTS study_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leader_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    course_code VARCHAR(20),
    course_name VARCHAR(255),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(200) UNIQUE,
    topic VARCHAR(255) NOT NULL,
    group_type group_type_enum DEFAULT 'pbl_project',
    description TEXT NOT NULL,
    tech_stack TEXT[] DEFAULT '{}',
    max_members INT DEFAULT 5,
    current_members INT DEFAULT 1,
    status group_status_enum DEFAULT 'recruiting',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_group_members (
    group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role group_member_role_enum DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- 6. Campus Events
CREATE TABLE IF NOT EXISTS campus_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer VARCHAR(150) NOT NULL,
    organizer_type VARCHAR(50) DEFAULT 'club',
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    start_time VARCHAR(100) NOT NULL,
    end_time VARCHAR(100),
    banner_url VARCHAR(1000),
    registration_url VARCHAR(1000),
    attendees_count INT DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
