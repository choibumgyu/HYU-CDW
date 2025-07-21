import columnMap from "../../lib/columnTranslationMap.json";

export function translateColumn(key: string): string {
    const translated = (columnMap as Record<string, string>)[key] || key;
    return translated.replaceAll("_", " ");
}
