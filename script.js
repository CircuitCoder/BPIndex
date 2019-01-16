// Resolve 404 redirect
if(window.location.hash.indexOf('#/') == 0) {
  const pn = window.location.hash.substr(1);
  window.history.replaceState(null, null, pn);
}

const DATE_FORMAT = 'YY-MM-DD HH:mm';

function loadComp(uri, rest) {
  return async () => {
    const resp = await fetch(uri);
    const tmpl = await resp.text();

    return Object.assign({ template: tmpl }, rest);
  }
}

const Series = loadComp('/series.html', {
  data: () => ({
    content: null,
  }),

  mounted() {
    this.reload();
  },

  methods: {
    async reload() {
      this.content = null;
      const name = this.$route.params.name;

      const resp = await fetch(`/desc/${name}.yml`);
      const yaml = await resp.text();

      const content = jsyaml.load(yaml);
      if(typeof content !== 'string')
        this.content = content;
      else
        this.content = 404;
    },
  },
});

const Home = loadComp('/home.html', {
  data: () => ({
    list: null,
  }),

  mounted() {
    this.reloadList();
  },

  methods: {
    async reloadList() {
      this.list = null;
      const name = this.$route.params.name;

      const resp = await fetch('/stat.json');
      const stat = await resp.json();
      this.list = Object.keys(stat).map(k => ({
        modified: new Date(stat[k].mtime),
        name: k,
      }));

      this.list.sort((a, b) => b.modified - a.modified);
    },

    formatDate(date) {
      return dateFns.format(date, DATE_FORMAT);
    },
  },
});

const routes = [
  { path: '/', component: Home },
  { path: '/:name', component: Series },
];

const router = new VueRouter({
  routes,
  mode: 'history',
});

const app = new Vue({
  router,
});

function bootstrap() {
  app.$mount('#app');
}
