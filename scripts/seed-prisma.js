/**
 * Prisma Database Seeder for Supabase PostgreSQL
 * Seeds the default Admin, demo readers, categories, tags, sample articles, and discussions.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Supabase PostgreSQL via Prisma ---');

  // Clear existing records in reverse dependency order
  console.log('Cleaning existing tables...');
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.savedBlog.deleteMany();
  await prisma.blogCategory.deleteMany();
  await prisma.blogTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.blog.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  // 1. Seed Users
  console.log('Seeding users...');
  const adminPasswordHash = bcrypt.hashSync('Admin@123456', 10);
  const readerPasswordHash = bcrypt.hashSync('Reader@123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'System Administrator',
      email: 'admin@blog.com',
      password_hash: adminPasswordHash,
      role: 'admin',
      bio: 'Lead System Architect & Platform Administrator.',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
    }
  });

  const john = await prisma.user.create({
    data: {
      name: 'John Reader',
      email: 'john@reader.com',
      password_hash: readerPasswordHash,
      role: 'reader',
      bio: 'Enthusiastic full-stack developer and tech reader.',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80'
    }
  });

  const sarah = await prisma.user.create({
    data: {
      name: 'Sarah Connor',
      email: 'sarah@reader.com',
      password_hash: readerPasswordHash,
      role: 'reader',
      bio: 'Cloud reliability enthusiast and distributed systems investigator.',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80'
    }
  });

  // 2. Seed Categories
  console.log('Seeding categories...');
  const catTech = await prisma.category.create({ data: { name: 'Technology', slug: 'technology' } });
  const catArch = await prisma.category.create({ data: { name: 'Software Architecture', slug: 'software-architecture' } });
  const catWeb = await prisma.category.create({ data: { name: 'Web Development', slug: 'web-development' } });
  const catEng = await prisma.category.create({ data: { name: 'Engineering', slug: 'engineering' } });
  const catSports = await prisma.category.create({ data: { name: 'Sports', slug: 'sports' } });
  const catMovies = await prisma.category.create({ data: { name: 'Movies', slug: 'movies' } });
  const catWeather = await prisma.category.create({ data: { name: 'Weather', slug: 'weather' } });

  // 3. Seed Tags
  console.log('Seeding tags...');
  const tagNode = await prisma.tag.create({ data: { name: 'nodejs', slug: 'nodejs' } });
  const tagSqlite = await prisma.tag.create({ data: { name: 'sqlite', slug: 'sqlite' } });
  const tagArch = await prisma.tag.create({ data: { name: 'architecture', slug: 'architecture' } });
  const tagSec = await prisma.tag.create({ data: { name: 'security', slug: 'security' } });
  const tagJs = await prisma.tag.create({ data: { name: 'javascript', slug: 'javascript' } });
  const tagIndia = await prisma.tag.create({ data: { name: 'india', slug: 'india' } });
  const tagWorld = await prisma.tag.create({ data: { name: 'world', slug: 'world' } });
  const tagVideo = await prisma.tag.create({ data: { name: 'video', slug: 'video' } });

  // 4. Seed Blogs
  console.log('Seeding blogs...');
  const blog1 = await prisma.blog.create({
    data: {
      title: 'Architecting Modern Web Applications with Resilient Full-Stack Patterns',
      slug: 'architecting-modern-web-applications',
      body: `<h2>Building for Long-Term Durability</h2>
      <p>In modern software engineering, web application longevity is determined by architectural discipline rather than the latest fleeting trends. By leveraging clean separation of concerns, transactional integrity, and role-based boundaries, teams deliver software that survives decades of evolution.</p>
      <blockquote>The essence of architecture is finding simplicity in complex distributed interactions.</blockquote>
      <h3>Key Pillars of Modern Design</h3>
      <ul>
        <li><strong>Strict Role-Based Access Control</strong>: Securing admin capabilities at the route layer.</li>
        <li><strong>Relational Integrity</strong>: Automatic cascading deletions ensuring pristine state.</li>
        <li><strong>Threaded Discussions</strong>: Real-time multi-level nested engagement.</li>
      </ul>`,
      cover_image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80',
      status: 'published',
      edition: 'india',
      author_id: admin.id,
      categories: { create: [{ category_id: catTech.id }, { category_id: catArch.id }] },
      tags: { create: [{ tag_id: tagNode.id }, { tag_id: tagArch.id }, { tag_id: tagIndia.id }] }
    }
  });

  const blog2 = await prisma.blog.create({
    data: {
      title: 'Zero-Leak Security and Role Governance in Production APIs',
      slug: 'zero-leak-security-and-role-governance',
      body: `<h2>Defense in Depth for Modern Web Services</h2>
      <p>Authentication verifies identity; authorization determines privileges. When security mechanisms fail, it is usually because developers relied solely on client-side state rather than verifying credentials on every sensitive backend transaction.</p>
      <h3>Cryptographic Validation</h3>
      <p>By enforcing signed JWT verification, rate-limiting, and strict parameter validation, APIs become resilient against injection and privilege escalation attacks.</p>`,
      cover_image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
      status: 'published',
      edition: 'india',
      author_id: admin.id,
      categories: { create: [{ category_id: catTech.id }, { category_id: catEng.id }] },
      tags: { create: [{ tag_id: tagSec.id }, { tag_id: tagJs.id }, { tag_id: tagIndia.id }] }
    }
  });

  const blog3 = await prisma.blog.create({
    data: {
      title: 'Global Tech Disruption: Microservices to Pragmatic Monoliths',
      slug: 'global-tech-disruption-monoliths',
      body: `<h2>The Great Architecture Reckoning</h2>
      <p>Across Silicon Valley and international tech hubs, engineering leadership is reconsidering the microservices dogma. The pragmatic modular monolith has emerged as the weapon of choice for fast-moving startups and large scale systems alike.</p>`,
      cover_image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      status: 'published',
      edition: 'world',
      author_id: admin.id,
      categories: { create: [{ category_id: catTech.id }, { category_id: catArch.id }] },
      tags: { create: [{ tag_id: tagArch.id }, { tag_id: tagWorld.id }] }
    }
  });

  // 5. Seed Interactions (Likes, Comments, Replies)
  console.log('Seeding comments and likes...');
  await prisma.like.create({ data: { blog_id: blog1.id, user_id: john.id } });
  await prisma.like.create({ data: { blog_id: blog1.id, user_id: sarah.id } });
  await prisma.like.create({ data: { blog_id: blog2.id, user_id: john.id } });

  const rootComment = await prisma.comment.create({
    data: {
      blog_id: blog1.id,
      user_id: john.id,
      content: 'Fascinating breakdown! Clean architecture and cascade deletion truly save engineering teams hours of debugging.'
    }
  });

  const replyComment = await prisma.comment.create({
    data: {
      blog_id: blog1.id,
      user_id: sarah.id,
      parent_id: rootComment.id,
      content: 'Completely agree John. SQLite in WAL mode combined with strict foreign keys provides surprising throughput.'
    }
  });

  await prisma.comment.create({
    data: {
      blog_id: blog1.id,
      user_id: admin.id,
      parent_id: replyComment.id,
      content: 'Thank you both for the great feedback! The goal was zero extraneous runtime baggage while guaranteeing transactional consistency.'
    }
  });

  // 6. Application Settings
  await prisma.setting.create({ data: { key: 'site_title', value: 'ApexBlog' } });
  await prisma.setting.create({ data: { key: 'allow_registration', value: 'true' } });

  console.log('====================================================');
  console.log('✅ Supabase PostgreSQL Database Seeded Successfully!');
  console.log('👤 Admin: admin@blog.com / Admin@123456');
  console.log('👤 Reader: john@reader.com / Reader@123');
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
