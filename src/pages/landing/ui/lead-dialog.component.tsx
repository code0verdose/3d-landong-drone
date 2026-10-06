import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { closeLead, useLeadDialog } from '@shared/lib/lead-dialog.store';
import { pauseScroll, resumeScroll } from '@shared/lib/lenis.store';
import { submitLead, type Lead } from '@shared/api/lead.api';
import styles from './lead-dialog.module.css';

const VOLUMES = ['До 50 заказов в день', '50–200 заказов в день', '200–500 заказов в день', 'Больше 500 заказов в день'];
const NO_PLAN = 'Пока не выбрал';

type Field = keyof Lead | 'consent';
type Errors = Partial<Record<Field, string>>;
type Status = 'idle' | 'sending' | 'sent' | 'failed';

const EMPTY: Lead = { name: '', company: '', phone: '', email: '', city: '', volume: VOLUMES[0], plan: NO_PLAN, comment: '' };

function validate(lead: Lead, consent: boolean): Errors {
  const errors: Errors = {};
  if (lead.name.trim().length < 2) errors.name = 'Как к вам обращаться?';
  if (lead.company.trim().length < 2) errors.company = 'Укажите компанию или магазин';
  const digits = lead.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 12) errors.phone = 'Нужен телефон, по которому можно позвонить';
  if (lead.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email.trim())) errors.email = 'Проверьте адрес почты';
  if (!lead.city.trim()) errors.city = 'В каком городе склад?';
  if (!consent) errors.consent = 'Без согласия мы не сможем связаться с вами';
  return errors;
}

/** Окно заявки на подключение. Нативный <dialog>: фокус, Esc и порядок слоёв — силами браузера. */
export function LeadDialog({ plans }: { plans: string[] }) {
  const { open, plan } = useLeadDialog();
  const dialog = useRef<HTMLDialogElement>(null);
  const [lead, setLead] = useState<Lead>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [receipt, setReceipt] = useState('');
  const uid = useId();

  // Эффект оправдан: синхронизация с внешней системой — модальный <dialog> браузера и плавная прокрутка.
  // Страница стоит ровно столько, сколько открыто окно: остановка снимается в очистке эффекта,
  // как бы окно ни закрылось — крестиком, кнопкой, Esc или кликом мимо.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (!open) {
      if (d.open) d.close();
      return;
    }
    if (!d.open) d.showModal();
    pauseScroll();
    return resumeScroll;
  }, [open]);

  // Новое открытие после отправленной заявки — чистая форма; кнопка тарифа подставляет тариф.
  const [openedFor, setOpenedFor] = useState<{ open: boolean; plan: string | null }>({ open, plan });
  if (openedFor.open !== open || openedFor.plan !== plan) {
    setOpenedFor({ open, plan });
    if (open) {
      if (status === 'sent') {
        setLead({ ...EMPTY, plan: plan ?? EMPTY.plan });
        setConsent(false);
        setTouched(false);
        setErrors({});
        setStatus('idle');
      } else if (plan) {
        setLead((l) => ({ ...l, plan }));
      }
    }
  }

  const set = <K extends keyof Lead>(key: K, value: Lead[K]) => {
    const next = { ...lead, [key]: value };
    setLead(next);
    if (touched) setErrors(validate(next, consent));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    const found = validate(lead, consent);
    setTouched(true);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0];
      dialog.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStatus('sending');
    try {
      const r = await submitLead({ ...lead, name: lead.name.trim(), company: lead.company.trim(), email: lead.email.trim(), city: lead.city.trim(), comment: lead.comment.trim() });
      setReceipt(r.number);
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  };

  const field = (key: Field) => ({
    id: `${uid}-${key}`,
    name: key,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${uid}-${key}-err` : undefined,
  });
  const error = (key: Field) => errors[key] && <span id={`${uid}-${key}-err`} className={styles.error}>{errors[key]}</span>;

  return (
    <dialog ref={dialog} className={styles.dialog} onClose={closeLead}
      onCancel={(e) => { e.preventDefault(); closeLead(); }} aria-labelledby={`${uid}-title`}
      onClick={(e) => { if (e.target === e.currentTarget) closeLead(); }}>
      <div className={styles.panel} data-lenis-prevent>
        <button type="button" className={styles.close} onClick={() => closeLead()} aria-label="Закрыть">×</button>
        {status === 'sent' ? (
          <div className={styles.done} role="status">
            <span className={styles.check} aria-hidden>✓</span>
            <h2 id={`${uid}-title`} className={styles.title}>Заявка {receipt} принята</h2>
            <p className={styles.lead}>
              {lead.name.trim()}, спасибо. Менеджер позвонит на {lead.phone.trim()} в течение рабочего дня,
              уточнит адрес склада и предложит дату выезда на крышу.
            </p>
            <button type="button" className={styles.submit} onClick={() => closeLead()}>Вернуться на сайт</button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <h2 id={`${uid}-title`} className={styles.title}>Подключить склад</h2>
            <p className={styles.lead}>Оставьте контакты: посчитаем маршруты от вашего склада и пришлём расчёт пилота.</p>

            <div className={styles.grid}>
              <label className={styles.field} htmlFor={`${uid}-name`}>
                <span>Имя</span>
                <input {...field('name')} autoComplete="name" value={lead.name} onChange={(e) => set('name', e.target.value)} />
                {error('name')}
              </label>
              <label className={styles.field} htmlFor={`${uid}-company`}>
                <span>Компания</span>
                <input {...field('company')} autoComplete="organization" value={lead.company} onChange={(e) => set('company', e.target.value)} />
                {error('company')}
              </label>
              <label className={styles.field} htmlFor={`${uid}-phone`}>
                <span>Телефон</span>
                <input {...field('phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 900 000-00-00"
                  value={lead.phone} onChange={(e) => set('phone', e.target.value.replace(/[^\d+()\s-]/g, ''))} />
                {error('phone')}
              </label>
              <label className={styles.field} htmlFor={`${uid}-email`}>
                <span>Почта <em>необязательно</em></span>
                <input {...field('email')} type="email" inputMode="email" autoComplete="email" value={lead.email} onChange={(e) => set('email', e.target.value)} />
                {error('email')}
              </label>
              <label className={styles.field} htmlFor={`${uid}-city`}>
                <span>Город склада</span>
                <input {...field('city')} autoComplete="address-level2" value={lead.city} onChange={(e) => set('city', e.target.value)} />
                {error('city')}
              </label>
              <label className={styles.field} htmlFor={`${uid}-volume`}>
                <span>Объём</span>
                <select {...field('volume')} value={lead.volume} onChange={(e) => set('volume', e.target.value)}>
                  {VOLUMES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </label>
            </div>

            <fieldset className={styles.plans}>
              <legend>Тариф</legend>
              {[...plans, NO_PLAN].map((p) => (
                <label key={p} className={styles.chip}>
                  <input type="radio" name="plan" value={p} checked={lead.plan === p} onChange={() => set('plan', p)} />
                  <span>{p}</span>
                </label>
              ))}
            </fieldset>

            <label className={styles.field} htmlFor={`${uid}-comment`}>
              <span>Комментарий <em>необязательно</em></span>
              <textarea {...field('comment')} rows={3} maxLength={1000} placeholder="Что возите, откуда и куда, какие сроки доставки сейчас"
                value={lead.comment} onChange={(e) => set('comment', e.target.value)} />
            </label>

            <label className={styles.consent}>
              <input {...field('consent')} type="checkbox" checked={consent}
                onChange={(e) => { setConsent(e.target.checked); if (touched) setErrors(validate(lead, e.target.checked)); }} />
              <span>Согласен на обработку персональных данных для ответа на заявку</span>
            </label>
            {error('consent')}

            {status === 'failed' && <p className={styles.failed} role="alert">Не получилось отправить заявку. Проверьте интернет и попробуйте ещё раз.</p>}
            <button type="submit" className={styles.submit} disabled={status === 'sending'}>
              {status === 'sending' ? 'Отправляем…' : 'Отправить заявку'}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
