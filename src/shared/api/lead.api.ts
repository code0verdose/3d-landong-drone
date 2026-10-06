export interface Lead {
  name: string;
  company: string;
  phone: string;
  email: string;
  city: string;
  volume: string;
  plan: string;
  comment: string;
}

export interface LeadReceipt { number: string }

const SEND_DELAY_MS = 900;

/**
 * Отправка заявки. У демонстрационного сайта нет сервера заявок: запрос имитируется задержкой,
 * номер заявки собирается из времени отправки. Подключение настоящего приёма — замена тела функции
 * на запрос к API, форма от этого не меняется.
 */
export async function submitLead(lead: Lead): Promise<LeadReceipt> {
  void lead;
  await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
  return { number: `L-${String(Date.now()).slice(-6)}` };
}
