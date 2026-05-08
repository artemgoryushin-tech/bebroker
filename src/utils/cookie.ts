export const getCookieByName = (name: string, cookiesData: string) => {
  const cookies: {
    [key: string]: string;
  } = cookiesData.split(';').reduce((prev, cookieString) => (
    {...prev,
      [cookieString.trim().split('=')[0]]: cookieString.trim().split('=')[1]
    }
  ), {})
  return cookies[name] ?? null;
}
