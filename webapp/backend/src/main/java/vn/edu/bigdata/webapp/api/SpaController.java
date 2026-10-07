package vn.edu.bigdata.webapp.api;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Trả index.html cho các route của React (tải lại trang /ml/kmeans... không bị 404). */
@Controller
class SpaController {
  @GetMapping({"/groupby", "/benchmarks", "/ml/kmeans", "/ml/knn"})
  String index() {
    return "forward:/index.html";
  }
}
