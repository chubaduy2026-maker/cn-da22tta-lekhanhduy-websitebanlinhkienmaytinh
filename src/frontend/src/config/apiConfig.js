const LOCAL_API_ORIGIN = 'http://localhost:5000';

const trimTrailingSlashes = (value = '') => String(value).replace(/\/+$/, '');

const ensureApiSuffix = (value = '') => {
  const normalized = trimTrailingSlashes(value);
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
};

const resolveApiUrls = () => {
  const rawEnvUrl = trimTrailingSlashes(process.env.REACT_APP_API_URL || '');

  if (rawEnvUrl) {
    const baseUrl = ensureApiSuffix(rawEnvUrl);
    return {
      API_BASE_URL: baseUrl,
      API_ORIGIN_URL: baseUrl.replace(/\/api$/i, '')
    };
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';

    if (!isLocal) {
      const origin = trimTrailingSlashes(window.location.origin);
      return {
        API_BASE_URL: `${origin}/api`,
        API_ORIGIN_URL: origin
      };
    }
  }

  return {
    API_BASE_URL: `${LOCAL_API_ORIGIN}/api`,
    API_ORIGIN_URL: LOCAL_API_ORIGIN
  };
};

const { API_BASE_URL, API_ORIGIN_URL } = resolveApiUrls();

export { API_BASE_URL, API_ORIGIN_URL };
