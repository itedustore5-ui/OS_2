export type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  imageQuestion?: string | null;
};

export const imagePathForQuestion = (id: number) => `/images/${id}.png`;

export const questionsFormatExample: QuizQuestion = {
  id: 102,
  question: "Текст питања",
  options: ["Одговор 1", "Одговор 2", "Одговор 3", "Одговор 4"],
  correctAnswer: 1,
  explanation: "Објашњење тачног одговора",
  imageQuestion: imagePathForQuestion(102),
};
