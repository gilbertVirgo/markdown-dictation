// OpenAI wants ISO-639-1 ("en"), not a BCP-47 tag ("en-GB").
export const langCode = (lang: string) => lang.split('-')[0].toLowerCase()
