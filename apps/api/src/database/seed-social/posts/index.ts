import { BUSINESS_POSTS } from './business'
import { FUN_POSTS } from './fun'
import { LIFE_POSTS } from './life'
import { MORE_POSTS } from './more'
import { OFFICIAL_POSTS } from './official'
import { STUDY_POSTS } from './study'
import { TECH_POSTS } from './tech'

// Gom bài theo chủ đề / All seed posts
export const ALL_POSTS = [...OFFICIAL_POSTS, ...TECH_POSTS, ...BUSINESS_POSTS, ...LIFE_POSTS, ...STUDY_POSTS, ...FUN_POSTS, ...MORE_POSTS]
