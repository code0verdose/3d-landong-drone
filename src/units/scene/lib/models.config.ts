// Как вписать модель в кадр и какой приём нужен поверх анимации из Блендера.
export type Special = 'drone';

export interface ModelConfig {
  file: string;
  special?: Special;
  fit?: number;            // радиус вписывания, по умолчанию 2.4
  fitAt?: number[];        // в какие моменты мерить габарит: путешествующей модели — только в начале
  fitIgnore?: string[];    // узлы, которые не участвуют в вписывании (окружение вокруг модели)
  liteGlass?: boolean;     // стекло без transmission: мелкие линзы не стоят второго рендера сцены
  atmosphere?: 'night-city';   // свет, туман и отражения ночного города вместо студии
}

// полная карта района из Блендера; камера задана в самой сцене (пустышки «Камера» и «Цель камеры»)
export const MODEL: ModelConfig = {
  file: 'drone', special: 'drone', fit: 1.8, fitAt: [0], liteGlass: true, atmosphere: 'night-city',
  fitIgnore: ['Площадка у двери', 'Окружение'],
};
