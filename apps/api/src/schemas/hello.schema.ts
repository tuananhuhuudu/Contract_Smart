/** Shape of the response of GET /api/v1/hello (like sche_*.py in the chatbot). */
export interface HelloResponse {
  message: string;
  databaseTime: string;
}
