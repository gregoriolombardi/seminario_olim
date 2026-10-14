// Conteúdo exibido no site. Os limites de vagas ficam na planilha (aba Workshops),
// casados com estes ids — mantenha os dois lados com os mesmos ids.

export type Workshop = {
  id: string;
  titulo: string;
  palestrante: string;
  descricao: string;
  // Sem valor, o check-in mostra "a definir". TODO: preencher sala e horário de todos.
  sala?: string;
  horario?: string;
};

export const workshops: Workshop[] = [
  {
    id: "eca-digital",
    titulo:
      "ECA Digital e demais legislações afins: como dar visibilidade ao trabalho pedagógico com segurança jurídica?",
    palestrante: "Ivana Atanásio",
    // TODO: trocar pela descrição oficial antes de divulgar.
    descricao: "Workshop sobre infância, direitos e o mundo digital.",
    sala: "Auditório principal",
  },
  {
    id: "projetos-educacao-infantil",
    titulo: "Projetos na educação infantil",
    palestrante: "Prof. Gil Menslin",
    descricao:
      "Uma imersão sobre o uso de projetos como estratégia para promover aprendizagem significativa na infância — transformando curiosidade em investigação.",
  },
  {
    id: "quando-o-corpo-aprende",
    titulo: "Quando o corpo aprende",
    palestrante: "Prof. Marcos Antonio Fari Júnior",
    descricao:
      "Movimento e desenvolvimento na infância: uma imersão sobre o papel do corpo no processo de aprendizagem, conectando movimento, desenvolvimento e infância ativa.",
  },
  {
    id: "quintalizar-os-espacos",
    titulo: "Quintalizar os espaços para humanizar as infâncias",
    palestrante: "Profª. Margareth Schafranski",
    descricao:
      "Reflexão prática sobre como os espaços influenciam a forma como as crianças aprendem, exploram e se relacionam — caminhos para territórios mais sensíveis e naturais.",
  },
  {
    id: "linguagem-da-comida",
    titulo: "A linguagem da comida",
    palestrante: "Profª. Denise Barreiros e Chef Gio Floriani",
    descricao:
      "Uma abordagem sensorial e cultural da alimentação como linguagem educativa, explorando a comida como ferramenta pedagógica para memória, identidade e cultura.",
  },
];
