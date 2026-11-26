import s from './drive.module.css';

/** VIN entry used on the landing: one pill field with the action inside it. */
export function VinForm({ id }: { id: string }) {
  return (
    <form action="/appraise" method="get" className={s.vinForm}>
      <label className="sr" htmlFor={id}>Vehicle identification number</label>
      <input id={id} name="vin" className="vin" placeholder="Enter your VIN" maxLength={17} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      <button type="submit" className="btn">Value it <span className="arr" aria-hidden="true">→</span></button>
    </form>
  );
}
