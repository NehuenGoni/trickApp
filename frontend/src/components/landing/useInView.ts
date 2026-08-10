import { useEffect, useRef, useState } from 'react';

/** Dispara una sola vez cuando el elemento entra en viewport — es lo que
 *  alimenta las animaciones de entrada por scroll de la landing. No se
 *  reobserva: una vez visible, queda visible (evita que el contenido
 *  parpadee si el usuario sube y baja la página). */
export const useInView = <T extends HTMLElement>(threshold = 0.15) => {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Sin IntersectionObserver (muy raro hoy) mostramos el contenido directo.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -80px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
};

export default useInView;
