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

      this.content = jsyaml.load(yaml);
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
