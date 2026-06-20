import axios from 'axios';
import { logger } from "./logger";

const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';

export interface NewsArticle {
  title: string;
  description: string;
  publishedAt: string;
  url: string;
  urlToImage: string;
  source: {
    name: string;
  };
}

export async function fetchMusicIndustryNews(): Promise<NewsArticle[]> {
  try {
    const response = await axios.get(`${BASE_URL}/everything`, {
      params: {
        q: 'music industry OR music business OR music marketing',
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey: NEWS_API_KEY
      }
    });

    return response.data.articles;
  } catch (error) {
    logger.error('Error fetching news:', error);
    return [];
  }
}
