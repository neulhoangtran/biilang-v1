import {
  getAppConfig,
  updateAppConfig,
} from './app-storage.service';

const MAX_SEARCH_TERMS = 5;

export async function getRecentSearchTerms() {
  const config = await getAppConfig();
  return config.search_terms ?? [];
}

export async function addRecentSearchTerm(keyword: string) {
  const value = keyword.trim();

  if (!value) {
    return getRecentSearchTerms();
  }

  const config = await getAppConfig();

  const nextTerms = [
    value,
    ...(config.search_terms ?? []).filter(
      item => item.toLowerCase() !== value.toLowerCase()
    ),
  ].slice(0, MAX_SEARCH_TERMS);

  await updateAppConfig({
    search_terms: nextTerms,
  });

  return nextTerms;
}

export async function removeRecentSearchTerm(keyword: string) {
  const config = await getAppConfig();

  const nextTerms = (config.search_terms ?? []).filter(
    item => item !== keyword
  );

  await updateAppConfig({
    search_terms: nextTerms,
  });

  return nextTerms;
}

export async function clearRecentSearchTerms() {
  await updateAppConfig({
    search_terms: [],
  });

  return [];
}