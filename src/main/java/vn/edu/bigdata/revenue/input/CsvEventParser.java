package vn.edu.bigdata.revenue.input;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;

public final class CsvEventParser implements EventParser {
  public static final String HEADER =
      "event_time,event_type,product_id,category_id,category_code,brand,price,user_id,user_session";
  public static final int MAX_LINE_BYTES = 65536;

  public ParseResult parse(String line) {
    if (line.endsWith("\r")) line = line.substring(0, line.length() - 1);
    if (line.getBytes(StandardCharsets.UTF_8).length > MAX_LINE_BYTES || line.indexOf('\n') >= 0)
      return ParseResult.malformed();
    if (line.indexOf('\r') >= 0) return ParseResult.malformed();
    if (line.startsWith("\uFEFF")) line = line.substring(1);
    try (CSVParser parser = CSVParser.parse(line, CSVFormat.RFC4180)) {
      List<CSVRecord> rows = parser.getRecords();
      if (rows.size() != 1 || rows.get(0).size() != 9) return ParseResult.malformed();
      CSVRecord r = rows.get(0);
      String[] names = HEADER.split(",");
      boolean header = true;
      for (int i = 0; i < 9; i++) header &= names[i].equals(r.get(i));
      if (header) return ParseResult.header();
      return ParseResult.event(new ParsedEvent(r.get(1), r.get(3), r.get(4), r.get(6)));
    } catch (IOException | java.io.UncheckedIOException | IllegalArgumentException e) {
      return ParseResult.malformed();
    }
  }
}
