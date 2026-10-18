import { z } from 'zod'
import { FLASHCARD_TEMPLATES, SPEECH_LANGS, type FlashcardContent } from '@pu/schemas'
import { STUDY_AI_MAX_ITEMS, type StudyKindDef } from './study-kind'

// Thẻ ghi nhớ: mô tả từng trường (.describe) đi thẳng vào JSON Schema N7AI nhận
export const FlashcardContentSchema = z.object({
  front: z.string().trim().min(1, { message: 'Mặt trước trống' }).max(500).describe('Term, word or short question (Markdown / $LaTeX$). Vocabulary: the word + part of speech, e.g. "Spaceship (n)"'),
  back: z.string().trim().min(1, { message: 'Mặt sau trống' }).max(2000).describe('Short answer or meaning, ≤ 2 sentences, in the user\'s language'),
  phonetic: z.string().trim().max(120).optional().describe('IPA / pinyin / romaji for vocabulary, e.g. "/ˈspeɪs.ʃɪp/"; omit otherwise'),
  example: z.string().trim().max(600).optional().describe('One short example sentence using the term (vocabulary, formulas); omit when not useful')
})

const FlashcardOptionsSchema = z.object({
  template: z.enum(FLASHCARD_TEMPLATES).optional().catch(undefined).describe('"vocab" for foreign-language vocabulary (shows phonetic, example, pronunciation); otherwise "basic"'),
  lang: z.enum(SPEECH_LANGS).optional().catch(undefined).describe('Language of the FRONT side for text-to-speech, e.g. "en-US"; omit if mixed or Vietnamese-only')
})

export const flashcardsKind: StudyKindDef<FlashcardContent> = {
  kind: 'flashcards',
  label: 'Flashcard',
  itemLabel: 'thẻ',
  item: FlashcardContentSchema,
  options: FlashcardOptionsSchema,
  fence: 'flashcards',
  itemsKey: 'cards',
  ai: {
    tool: 'create_flashcards',
    description:
      'Create a flashcard deck and save it to the user\'s PU Connector Tools › Flashcard (spaced-repetition review). Use when the user wants to memorise terms, vocabulary, formulas or key concepts, or asks for flashcards.',
    instructions: [
      `Topic only ⇒ 8–12 core cards. The user gives a concrete list (vocabulary, terms, a photo of a word list) or a number ⇒ include EVERY item, no merging or dropping (max ${STUDY_AI_MAX_ITEMS}).`,
      'Foreign-language vocabulary ⇒ template "vocab", set lang, fill phonetic and a short example for every card; the back holds the Vietnamese meaning.',
      'Do not invent facts beyond the user\'s material or well-established knowledge.'
    ].join(' '),
    defaultTitle: 'Flashcard từ N7AI'
  }
}
