import axios from 'axios/dist/node/axios.cjs';
import { getApiKey } from '../config/backend';

const http = axios.create({
  headers: {
    'X-API-Key': getApiKey(),
  },
});

export default http;

