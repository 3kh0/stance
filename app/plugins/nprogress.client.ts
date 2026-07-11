import NProgress from "nprogress";
import "nprogress/nprogress.css";
import "~/assets/css/nprogress.css";

export default defineNuxtPlugin(() => {
  const router = useRouter();
  const cls = "stance-route-loading";
  const root = () => document.documentElement;
  const stop = () => {
    root().classList.remove(cls);
    NProgress.done();
  };

  NProgress.configure({ showSpinner: false, speed: 180, trickleSpeed: 280 });
  router.beforeEach(() => {
    root().classList.add(cls);
    NProgress.start();
  });
  router.afterEach(stop);
  router.onError(stop);
});
